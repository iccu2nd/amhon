import { authorize, headers, API, errorText, axios } from "../lib/github.js";

export default async function handler(req, res) {
  if (!authorize(req, res)) return;

  try {
    if (req.method === "GET") {
      const { data } = await axios.get(`${API}/user/repos?per_page=100&sort=updated`, { headers: headers() });
      return res.status(200).json({
        repos: data.map(repo => ({
          name: repo.name,
          html_url: repo.html_url,
          private: repo.private,
          updated_at: repo.updated_at
        }))
      });
    }

    if (req.method === "DELETE") {
      const repo = String(req.body?.repo || "");
      if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
        return res.status(400).json({ error: "Nama repository tidak valid." });
      }

      await axios.delete(`${API}/repos/${process.env.GITHUB_USERNAME}/${encodeURIComponent(repo)}`, { headers: headers() });
      return res.status(200).json({ message: "Repository berhasil dihapus." });
    }

    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ error: "Method tidak diizinkan." });
  } catch (error) {
    return res.status(400).json({ error: errorText(error) });
  }
}