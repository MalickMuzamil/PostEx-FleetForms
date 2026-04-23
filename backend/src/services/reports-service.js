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

        const authPool = await getAuthPool();

        const authRequest = authPool.request();
        authRequest.timeout = 30000;
        const userResult = await authRequest
            .input("email", sql.VarChar, normalizedEmail)
            .query(`
                SELECT TOP 1
                    Login_Id,
                    Login_Name,
                    Login_Role,
                    Login_Blocked,
                    Login_EMail,
                    Emp_ID,
                    u_BranchID,
                    u_BranchName
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
                user: {
                    Login_Id: user.Login_Id,
                    Login_Name: user.Login_Name,
                    Login_EMail: user.Login_EMail,
                    Login_Role: user.Login_Role,
                },
                reason: "USER_BLOCKED",
                message: "User is blocked"
            };
        }

        const loginId = user.Login_Id;

        // ============ STEP 2: GoGreen.dbo.UserBranchDetail ============
        const appPool = await getPool();
        const hrmPool = await getHrmPool();

        const appRequest = appPool.request();
        appRequest.timeout = 30000;
        const branchDetailResult = await appRequest
            .input("userId", sql.VarChar, loginId)
            .query(`
                SELECT
                    ubd.BranchID,
                    b.BranchName
                FROM UserBranchDetail ubd
                INNER JOIN [HRM].[HR].[Branches] b ON ubd.BranchID = b.BranchID
                WHERE ubd.UserID = @userId
            `);

        const branchDetails = branchDetailResult.recordset || [];
        const branchCount = branchDetails.length;

        // Get total branch count
        const hrmRequest = hrmPool.request();
        hrmRequest.timeout = 30000;
        const totalBranchesResult = await hrmRequest.query("SELECT COUNT(*) as TotalBranches FROM [HRM].[HR].[Branches]");
        const totalBranches = totalBranchesResult.recordset[0]?.TotalBranches || 0;

        // ============ DETERMINE BRANCH ACCESS SCENARIO ============
        let branchAccessScenario = {
            scenario: "",
            description: "",
            branches: [],
            totalBranches: totalBranches,
            isAllBranches: false
        };

        let cmsUser = null;

        // SCENARIO 1: user has branches (any count)
        if (branchCount >= 1) {
            let scenario = "SINGLE BRANCH";
            let description = `User has access to ${branchCount} branch(es)`;

            if (branchCount > 1 && branchCount < totalBranches) {
                scenario = "MULTIPLE BRANCHES NOT ALL";
                description = `User has access to ${branchCount} branches (not all)`;
            } else if (branchCount >= totalBranches) {
                scenario = "ALL BRANCHES VIA USERBRANCHDETAIL";
                description = "User has access to all branches via UserBranchDetail";
            }

            branchAccessScenario = {
                scenario: scenario,
                description: description,
                branches: branchDetails.map(b => ({
                    branchId: b.BranchID,
                    branchName: b.BranchName
                })),
                totalBranches: totalBranches,
                isAllBranches: branchCount >= totalBranches
            };
        }
        // SCENARIO 2 & 3: Only check if no branches from UserBranchDetail
        else {
            // ============ STEP 3: GoGreen.dbo.CMSUsers ============
            const cmsRequest = appPool.request();
            cmsRequest.timeout = 30000;
            const cmsUserResult = await cmsRequest
                .input("userId", sql.VarChar, loginId)
                .query(`
                    SELECT
                        cu.IsAllowAllBranches,
                        cu.OriginCity,
                        c.CityName
                    FROM CMSUsers cu
                    LEFT JOIN City c ON cu.OriginCity = c.CityID
                    WHERE cu.UserID = @userId
                `);

            cmsUser = cmsUserResult.recordset?.[0];

            // SCENARIO 2: CMSUsers (IsAllowAllBranches = true)
            if (cmsUser?.IsAllowAllBranches === true || cmsUser?.IsAllowAllBranches === 1) {
                // Get all branches from HRM
                const allBranchesResult = await hrmPool.request()
                    .query("SELECT BranchID, BranchName FROM [HRM].[HR].[Branches]");
                
                const allBranches = allBranchesResult.recordset || [];

                branchAccessScenario = {
                    scenario: "ALL BRANCHES",
                    description: "User has access to all branches (IsAllowAllBranches = 1)",
                    branches: allBranches.map(b => ({
                        branchId: b.BranchID,
                        branchName: b.BranchName
                    })),
                    totalBranches: totalBranches,
                    isAllBranches: true
                };
            }
            // SCENARIO 3: CMSUsers (OriginCity -> City -> Branches)
            else if (cmsUser?.OriginCity) {
                // Get branches for that city via City table (City is in GoGreen DB)
                const cityRequest = appPool.request();
                cityRequest.timeout = 30000;
                const cityBranchesResult = await cityRequest
                    .input("cityId", sql.Int, cmsUser.OriginCity)
                    .query(`
                        SELECT b.BranchID, b.BranchName
                        FROM City c
                        INNER JOIN [HRM].[HR].[Branches] b ON c.BranchID = b.BranchID
                        WHERE c.CityID = @cityId
                    `);
                
                const cityBranches = cityBranchesResult.recordset || [];
                const cityBranchCount = cityBranches.length;

                if (cityBranchCount === 1) {
                    branchAccessScenario = {
                        scenario: "SINGLE BRANCH VIA CITY",
                        description: `User has access to single branch via city: ${cmsUser.CityName}`,
                        branches: cityBranches.map(b => ({
                            branchId: b.BranchID,
                            branchName: b.BranchName
                        })),
                        totalBranches: totalBranches,
                        isAllBranches: false
                    };
                } else if (cityBranchCount > 1) {
                    branchAccessScenario = {
                        scenario: "MULTIPLE BRANCHES VIA CITY",
                        description: `User has access to ${cityBranchCount} branches via city: ${cmsUser.CityName}`,
                        branches: cityBranches.map(b => ({
                            branchId: b.BranchID,
                            branchName: b.BranchName
                        })),
                        totalBranches: totalBranches,
                        isAllBranches: false
                    };
                } else {
                    branchAccessScenario = {
                        scenario: "NO BRANCH ACCESS",
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
                    scenario: "NO BRANCH ACCESS",
                    description: "User has no branch access in any table",
                    branches: [],
                    totalBranches: totalBranches,
                    isAllBranches: false
                };
            }
        }

        console.log(`✅ User verified: ${user.Login_EMail} (ID: ${user.Login_Id}, Role: ${user.Login_Role})`);
        console.log(`📍 Branch Access: ${branchAccessScenario.scenario}`);

        return {
            ok: true,
            verified: true,
            user: {
                Login_Id: user.Login_Id,
                Login_Name: user.Login_Name,
                Login_EMail: user.Login_EMail,
                Login_Role: user.Login_Role,
                Emp_ID: user.Emp_ID,
                u_BranchID: user.u_BranchID,
                u_BranchName: user.u_BranchName,
            },
            branchAccess: branchAccessScenario,
            cmsUser: cmsUser ? {
                IsAllowAllBranches: cmsUser.IsAllowAllBranches,
                OriginCity: cmsUser.OriginCity,
                CityName: cmsUser.CityName
            } : null
        };
    }
}