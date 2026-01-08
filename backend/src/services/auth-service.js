import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import sql from "mssql";
import { getPool } from "../config/sql-config.js";

export default class AuthService {
    async login(email, password) {
        const pool = await getPool();

        const result = await pool
            .request()
            .input("email", sql.VarChar, email)
            .query(`
        SELECT id, email, passwordHash, role
        FROM users
        WHERE email = @email
      `);

        const user = result.recordset?.[0];
        if (!user) throw this._unauthorized();

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) throw this._unauthorized();

        const token = jwt.sign(
            { sub: user.id, email: user.email, role: user.role || "user" },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        return { token, user: { id: user.id, email: user.email, role: user.role || "user" } };
    }

    async signup({ name, email, password }) {
        const pool = await getPool();

        const exists = await pool
            .request()
            .input("email", sql.VarChar, email)
            .query(`SELECT id FROM users WHERE email = @email`);

        if (exists.recordset?.length) throw this._conflict("Email already exists");

        const passwordHash = await bcrypt.hash(password, 10);

        const created = await pool
            .request()
            .input("name", sql.VarChar, name)
            .input("email", sql.VarChar, email)
            .input("passwordHash", sql.VarChar, passwordHash)
            .input("role", sql.VarChar, "user")
            .query(`
        INSERT INTO users (name, email, passwordHash, role)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.role
        VALUES (@name, @email, @passwordHash, @role)
      `);

        const user = created.recordset?.[0];

        const token = jwt.sign(
            { sub: user.id, email: user.email, role: user.role || "user" },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        return { token, user: { id: user.id, email: user.email, role: user.role || "user" } };
    }

    _unauthorized() {
        const err = new Error("Invalid email or password");
        err.status = 401;
        return err;
    }

    _conflict(message) {
        const err = new Error(message);
        err.status = 409;
        return err;
    }
}
