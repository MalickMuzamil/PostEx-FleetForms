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

        const normalizedEmail = String(email).trim().toLowerCase();

        // ✅ 1) DB se user nikaalo
        const pool = await getAuthPool();

        const dbRes = await pool.request()
            .input("email", sql.VarChar, normalizedEmail)
            .query(`
        SELECT TOP 1
          id,
          name,
          email,
          phone,
          role
        FROM Users
        WHERE LOWER(email) = @email
      `);

        const user = dbRes.recordset?.[0];
        if (!user) throw this._badRequest("User not found");

        // const payload = {
        //     id: user.id,
        //     email: user.email,
        //     role: user.role
        // };

        return { ok: true, user };

        // const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

        // return { ok: true, token, user };
    }

    _badRequest(msg) {
        const err = new Error(msg);
        err.status = 400;
        return err;
    }
}
