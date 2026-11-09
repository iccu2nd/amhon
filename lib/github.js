import axios from "axios";

export const API = "https://api.github.com";

export function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

export function authorize(req, res) {
  const { GITHUB_TOKEN, GITHUB_USERNAME, ADMIN_PASSWORD } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_USERNAME || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    res.status(500).json({ error: "Environment Variables Vercel belum lengkap atau ADMIN_PASSWORD terlalu pendek." });
    return false;
  }

  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Password dashboard salah." });
    return false;
  }

  return true;
}

export function errorText(error) {
  return error?.response?.data?.message || error?.message || "Terjadi kesalahan.";
}

export { axios };