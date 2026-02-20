import { jwtVerify, importJWK } from "jose";

let cachedKeys = null;

async function getKey(kid) {
    if (!cachedKeys) {
        const res = await fetch(process.env.POSTEX_JWKS_URL);
        const json = await res.json();
        cachedKeys = json.data.keys;   
    }

    const jwk = cachedKeys.find(k => k.kid === kid);
    if (!jwk) throw new Error("Key not found");

    return await importJWK(jwk, "RS256");
}

export const authMiddleware = async (req, res, next) => {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const headerPart = JSON.parse(
            Buffer.from(token.split(".")[0], "base64").toString()
        );

        const key = await getKey(headerPart.kid);

        const { payload } = await jwtVerify(token, key, {
            issuer: process.env.POSTEX_ISSUER,
            audience: process.env.POSTEX_AUDIENCE,
        });

        req.user = payload;
        next();
    } catch (e) {
        console.error(e);
        return res.status(401).json({ message: "Invalid token" });
    }
};