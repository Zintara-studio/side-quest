import { NextResponse } from "next/server";
import { SignJWT } from "jose";

// In a real app, this would be a secure random string stored in .env
// We need to use 'jose' because standard jsonwebtoken doesn't work in Next.js Edge runtime
const SECRET_KEY = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "super-secret-key-for-local-dev-only-32c"
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Missing Google OAuth credentials" }, { status: 500 });
  }

  try {
    // 1. Exchange the code for an access token and id token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Google token error:", tokenData);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=oauth_failed`);
    }

    // 2. Use the access token to get user profile information
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userResponse.json();

    // 3. Create a mock user session since we don't have a backend yet
    // In a real scenario, you would send this to your Spring Boot backend or create a user in your DB here
    const mockUser = {
      id: "google-" + googleUser.id, // Prefix to ensure it doesn't collide
      name: googleUser.name,
      email: googleUser.email,
      role: "STUDENT", // Default role
    };

    // 4. Generate mock JWTs (simulating what the Spring Boot backend would do)
    const accessToken = await new SignJWT({ sub: mockUser.id, ...mockUser })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(SECRET_KEY);

    // Using a simpler JWT for the refresh token since it just needs to be an opaque string for this mock
    const refreshToken = "mock-refresh-token-" + Math.random().toString(36).substring(7);

    // 5. Construct the AuthResponse payload matching `src/lib/api/types.ts`
    const authResponsePayload = {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: 900,
      user: mockUser,
    };

    // 6. Encode the payload and redirect to the frontend callback page
    // We pass the payload as a base64 encoded JSON string to easily hydrate the Zustand store
    const payloadStr = Buffer.from(JSON.stringify(authResponsePayload)).toString("base64");
    
    // Set cookie for refresh token as the Spring Boot backend would
    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/callback?payload=${payloadStr}`);
    
    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/v1/auth",
      maxAge: 2592000 // 30 days
    });

    return response;

  } catch (error) {
    console.error("OAuth Exchange Error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=server_error`);
  }
}
