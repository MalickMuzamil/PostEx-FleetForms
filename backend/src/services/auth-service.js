import jwt from "jsonwebtoken";
import sql from "mssql";
import { getAuthPool } from "../config/sql-config.js";

export default class AuthService {
    async login(username, password) {
        const pool = await getAuthPool();

        if (!username || !password) throw this._unauthorized();

        const cleanUsername = String(username).trim();
        const cleanPassword = String(password).trim();

    //     const debug = await pool.request()
    //         .input("loginId", sql.VarChar(50), cleanUsername)
    //         .query(`
    //     SELECT DB_NAME() AS current_db, @@SERVERNAME AS server_name;

    //     SELECT 
    //       Login_Id,
    //       DATALENGTH(Login_Password) AS pass_bytes,
    //       CONVERT(varchar(32), Login_Password, 2) AS stored_hash
    //     FROM dbo.users
    //     WHERE Login_Id = @loginId;
    //   `);

        // console.log("DB CHECK:", debug.recordsets?.[0]?.[0]);     
        // console.log("USER CHECK:", debug.recordsets?.[1]);        

        // ✅ Actual login query (MD5)
        const result = await pool
            .request()
            .input("loginId", sql.VarChar(50), cleanUsername)
            .input("password", sql.VarChar(150), cleanPassword)
            .query(`
        SELECT Login_Id, Login_Role, Login_Blocked
        FROM dbo.users
        WHERE Login_Id = @loginId
          AND Login_Password = HASHBYTES('MD5', @password);
      `);

        // console.log("Auth query result:", result.recordset);

        const user = result.recordset?.[0];
        if (!user) throw this._unauthorized();

        if (user.Login_Blocked) throw new Error("User is blocked. Contact administrator.");

        const token = jwt.sign(
            { sub: user.ID, username: user.Login_Id, role: user.Login_Role || "user" },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        return { token, user: { id: user.ID, username: user.Login_Id, role: user.Login_Role || "user" } };
    }

    _unauthorized() {
        const err = new Error("Invalid username or password");
        err.status = 401;
        return err;
    }
}
