import { createRemoteJWKSet, jwtVerify } from "jose";
import { COGNITO_USER_POOL_ID, COGNITO_REGION } from "./cognito";

const jwksUri = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
  }
  return jwks;
}

export type TokenPayload = {
  sub: string;
  username: string;
  email: string;
  groups: string[];
};

export async function verifyIdToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
    });
    return {
      sub: payload.sub as string,
      username: (payload["cognito:username"] as string) || "",
      email: (payload.email as string) || "",
      groups: (payload["cognito:groups"] as string[]) || [],
    };
  } catch {
    return null;
  }
}

export async function verifyAndGetAdmin(token: string): Promise<{ user: TokenPayload; isAdmin: boolean } | null> {
  const user = await verifyIdToken(token);
  if (!user) return null;
  return { user, isAdmin: user.groups.includes("admin") };
}
