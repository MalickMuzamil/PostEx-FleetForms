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

        // Frontend will call PostEx SDK and send OTP itself.
        return { ok: true, email };
    }

    async verifyOtp(email, otpCode) {
        if (!email) throw this._badRequest("Email required");
        if (!otpCode) throw this._badRequest("otpCode required");

        const user = { email: String(email).trim().toLowerCase() };

        const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });

        return { ok: true, token, user };
    }

    _badRequest(msg) {
        const err = new Error(msg);
        err.status = 400;
        return err;
    }
}