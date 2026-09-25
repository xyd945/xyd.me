import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { requestEmailCode, verifyEmailCode } from "../lib/email-otp.ts";

let requests = 0, signedIn = false;
const expires = Math.floor(Date.now() / 1000) + 3600;
const user = { id: "00000000-0000-4000-8000-000000000001", email: "owner@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const jwt = [ { alg: "HS256", typ: "JWT" }, { sub: user.id, exp: expires }, "test-signature" ].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".");
const client = createClient("https://auth.example.test", "sb_publishable_test", {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    requests++;
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body));
    assert.equal(init?.method, "POST");
    if (url.pathname === "/auth/v1/otp") {
      assert.equal(body.create_user, false, "Requests and resends must never create accounts");
      assert.equal(url.searchParams.has("redirect_to"), false, "Code sign-in does not need a redirect");
      if (body.email !== user.email) return Response.json({ msg: "Signups not allowed for otp", code: "otp_disabled" }, { status: 400 });
      return Response.json({});
    }
    assert.equal(url.pathname, "/auth/v1/verify");
    assert.equal(body.email, user.email);
    assert.equal(body.type, "email");
    if (body.token === "000000") return Response.json({ msg: "Token has expired or is invalid", code: "otp_expired" }, { status: 403 });
    assert.equal(body.token, "012345", "Keep leading zeroes when verifying a code");
    return Response.json({ access_token: jwt, token_type: "bearer", refresh_token: "test-refresh", expires_in: 3600, user });
  } },
});
const { data: listener } = client.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") signedIn = true; });

const email = await requestEmailCode(client, ` ${user.email} `);
assert.equal(email, user.email);
assert.equal((await client.auth.getSession()).data.session, null, "Sending a code must not sign in");
await requestEmailCode(client, email); // Resend has the same no-signup policy.
await assert.rejects(requestEmailCode(client, "unknown@example.test"), /Signups not allowed/);
const beforeInvalid = requests;
for (const invalid of ["", "12345", "1234567", "12a456", "１２３４５６"]) {
  await assert.rejects(verifyEmailCode(client, email, invalid), /six-digit code/);
}
assert.equal(requests, beforeInvalid, "Malformed codes must not reach the auth API");
await assert.rejects(verifyEmailCode(client, email, "000000"), /expired or is invalid/);
assert.equal((await client.auth.getSession()).data.session, null, "Rejected codes must not sign in");
await verifyEmailCode(client, email, "012345");
assert.equal((await client.auth.getSession()).data.session?.user.id, user.id);
assert.ok(signedIn, "Verification must trigger the studio’s existing session listener");
listener.subscription.unsubscribe();
console.log("PASS: email OTP requests/resends disable signup; code validation, leading zeroes, invalid-code errors and session sign-in");
