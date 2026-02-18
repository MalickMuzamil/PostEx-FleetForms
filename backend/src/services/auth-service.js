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

        // Frontend already verifies OTP via SDK.
        // Here you can issue your own JWT/session if you want.
        return { ok: true };
    }

    _badRequest(msg) {
        const err = new Error(msg);
        err.status = 400;
        return err;
    }
}