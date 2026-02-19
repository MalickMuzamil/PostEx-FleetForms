import jwt from "jsonwebtoken";
import sql from "mssql";
import { getAuthPool } from "../config/sql-config.js";

export default class AuthService {
    async login(email) {
        if (!email) throw this._badRequest("Email required");
        return this.startOtp(email);
    }

    async startOtp(email) {
        if (!email) throw this._badRequest("Email required");
        return { ok: true, email };
    }

    async verifyOtp(email, otpCode) {
        if (!email) throw this._badRequest("Email required");
        if (!otpCode) throw this._badRequest("otpCode required");
        return this.issueJwt(email);
    }

    async issueJwt(email) {
        if (!email) throw this._badRequest("Email required");

        const cleanEmail = String(email).trim().toLowerCase();

        const pool = await getAuthPool();
        const result = await pool
            .request()
            .input("email", sql.VarChar(80), cleanEmail)
            .query(`
      SELECT
        Login_Id,
        Login_Name,
        Login_Role,
        Login_Blocked,
        Login_EMail
      FROM dbo.users
      WHERE LOWER(Login_EMail) = @email
    `);

        const u = result.recordset?.[0];
        if (!u) throw this._badRequest("User not found");

        if (u.Login_Blocked === 1 || u.Login_Blocked === true) {
            throw this._badRequest("User is blocked");
        }

        const payload = {
            loginId: u.Login_Id,
            email: u.Login_EMail,
            role: u.Login_Role,
            name: u.Login_Name,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: "7d"
        });

        const user = {
            loginId: u.Login_Id,
            name: u.Login_Name,
            email: u.Login_EMail,
            role: u.Login_Role,
            blocked: !!u.Login_Blocked
        };

        return { ok: true, token, user };
    }

    _badRequest(msg) {
        const err = new Error(msg);
        err.status = 400;
        return err;
    }
}