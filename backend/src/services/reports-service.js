import sql from "mssql";
import { getAuthPool, getPool, getHrmPool } from "../config/sql-config.js";

export default class ReportsService {
    async verifyUser(email) {
        if (!email) {
            const err = new Error("Email required");
            err.status = 400;
            throw err;
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        // ============ STEP 1: SecurityCatalog.dbo.Users ============
        const authPool = await getAuthPool();

        const userResult = await authPool.request()
            .input("email", sql.VarChar, normalizedEmail)
            .query(`
                SELECT TOP 1
                    Login_Id,
                    Login_Password,
                    Login_Name,
                    Login_Role,
                    Login_Blocked,
                    Login_EMail,
                    Emp_ID,
                    u_BranchID,
                    u_BranchName,
                    Login_Allowed_Discount,
                    Login_Allowed_Cost_Management,
                    FranchiseID,
                    FranchiseName,
                    Login_Allowed_Stock_Issuance,
                    RestrictedGLCodesOnly,
                    UserImage,
                    IMEINo,
                    UserProfilePicture,
                    AssignedMacAddress,
                    MobileNo,
                    OTP,
                    EnteredOn,
                    IsArchived
                FROM Users
                WHERE LOWER(Login_EMail) = @email
            `);

        const user = userResult.recordset?.[0];

        if (!user) {
            const err = new Error("User not found in SecurityCatalog");
            err.status = 404;
            throw err;
        }

        // Check if user is blocked
        if (user.Login_Blocked) {
            console.log(`❌ User blocked: ${user.Login_EMail}`);
            return {
                ok: true,
                verified: false,
                user: user,
                reason: "USER_BLOCKED",
                message: "User is blocked"
            };
        }

        const loginId = user.Login_Id;
        const empId = user.Emp_ID;

        // ============ STEP 2: GoGreen.dbo.UserBranchDetail ============
        const appPool = await getPool();
        const hrmPool = await getHrmPool();

        const branchDetailResult = await appPool.request()
            .input("userId", sql.VarChar, empId)
            .query(`
                SELECT 
                    ubd.BranchID,
                    b.BranchName,
                    b.BranchDesc
                FROM UserBranchDetail ubd
                INNER JOIN [HRM].[HR].[Branches] b ON ubd.BranchID = b.BranchID
                WHERE ubd.UserID = @userId
            `);

        const branchDetails = branchDetailResult.recordset || [];
        const branchCount = branchDetails.length;

        // Get total branch count from HRM DB
        const totalBranchesResult = await hrmPool.request().query("SELECT COUNT(*) as TotalBranches FROM [HRM].[HR].[Branches]");
        const totalBranches = totalBranchesResult.recordset[0]?.TotalBranches || 0;

        // ============ STEP 3: GoGreen.dbo.CMSUsers ============
        const cmsUserResult = await appPool.request()
            .input("userId", sql.VarChar, empId)
            .query(`
                SELECT 
                    cu.UserID,
                    cu.IsAllowAllBranches,
                    cu.OriginCity,
                    c.CityName
                FROM CMSUsers cu
                LEFT JOIN City c ON cu.OriginCity = c.CityID
                WHERE cu.UserID = @userId
            `);

        const cmsUser = cmsUserResult.recordset?.[0];

        // ============ DETERMINE BRANCH ACCESS SCENARIO ============
        let branchAccessScenario = {
            scenario: "",
            description: "",
            branches: [],
            totalBranches: totalBranches,
            isAllBranches: false
        };

        // SCENARIO 1: UserBranchDetail me record mila -> more than one branch but not all
        if (branchCount > 1 && branchCount < totalBranches) {
            branchAccessScenario = {
                scenario: "MULTIPLE_BRANCHES_NOT_ALL",
                description: `User has access to ${branchCount} branches (not all)`,
                branches: branchDetails.map(b => ({
                    branchId: b.BranchID,
                    branchName: b.BranchName,
                    branchDesc: b.BranchDesc
                })),
                totalBranches: totalBranches,
                isAllBranches: false
            };
        }
        // SCENARIO 2: If above false -> CMSUsers (IsAllowAllBranches = 1)
        else if (cmsUser?.IsAllowAllBranches === 1 || branchCount >= totalBranches) {
            // Get all branches from HRM DB
            const allBranchesResult = await hrmPool.request()
                .query("SELECT BranchID, BranchName, BranchDesc FROM [HRM].[HR].[Branches]");
            
            const allBranches = allBranchesResult.recordset || [];
            
            branchAccessScenario = {
                scenario: "ALL_BRANCHES",
                description: "User has access to all branches",
                branches: allBranches.map(b => ({
                    branchId: b.BranchID,
                    branchName: b.BranchName,
                    branchDesc: b.BranchDesc
                })),
                totalBranches: totalBranches,
                isAllBranches: true
            };
        }
        // SCENARIO 3: If above false -> CMSUsers (OriginCity -> City -> Branches)
        else if (cmsUser?.OriginCity) {
            // Get branches for that city from HRM DB
            const cityBranchesResult = await hrmPool.request()
                .input("cityId", sql.Int, cmsUser.OriginCity)
                .query(`
                    SELECT BranchID, BranchName, BranchDesc 
                    FROM [HRM].[HR].[Branches] 
                    WHERE CityID = @cityId
                `);
            
            const cityBranches = cityBranchesResult.recordset || [];
            const cityBranchCount = cityBranches.length;

            if (cityBranchCount === 1) {
                branchAccessScenario = {
                    scenario: "SINGLE_BRANCH_VIA_CITY",
                    description: `User has access to single branch via city: ${cmsUser.CityName}`,
                    branches: cityBranches.map(b => ({
                        branchId: b.BranchID,
                        branchName: b.BranchName,
                        branchDesc: b.BranchDesc
                    })),
                    totalBranches: totalBranches,
                    isAllBranches: false
                };
            } else if (cityBranchCount > 1) {
                branchAccessScenario = {
                    scenario: "MULTIPLE_BRANCHES_VIA_CITY",
                    description: `User has access to ${cityBranchCount} branches via city: ${cmsUser.CityName}`,
                    branches: cityBranches.map(b => ({
                        branchId: b.BranchID,
                        branchName: b.BranchName,
                        branchDesc: b.BranchDesc
                    })),
                    totalBranches: totalBranches,
                    isAllBranches: false
                };
            } else {
                branchAccessScenario = {
                    scenario: "NO_BRANCH_ACCESS",
                    description: "OriginCity set but no branches found",
                    branches: [],
                    totalBranches: totalBranches,
                    isAllBranches: false
                };
            }
        }
        // FALLBACK: No branch info anywhere
        else {
            branchAccessScenario = {
                scenario: "NO_BRANCH_ACCESS",
                description: "User has no branch access in any table",
                branches: [],
                totalBranches: totalBranches,
                isAllBranches: false
            };
        }

        console.log(`✅ User verified: ${user.Login_EMail} (ID: ${user.Login_Id}, Role: ${user.Login_Role})`);
        console.log(`📍 Branch Access Scenario: ${branchAccessScenario.scenario} - ${branchAccessScenario.description}`);

        return {
            ok: true,
            verified: true,
            user: user,
            branchAccess: branchAccessScenario,
            cmsUser: cmsUser || null
        };
    }
}