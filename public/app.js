const $ = id => document.getElementById(id);
let mode = "merge";
let busy = false;

function password() { return $("password").value.trim(); }
function notice(message, type = "ok") {
  $("notice").textContent = message;
  $("notice").className = `notice ${type}`;
}
function setBusy(value) {
  busy = value;
  $("upload").disabled = value;
  $("connect").disabled = value;
  $("refresh").disabled = value;
  $("upload").innerHTML = value ? "Memproses..." : 'Upload ke GitHub <span>↗</span>';
}
async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("x-admin-password", password());
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
  return data;
}
async function loadRepos() {
  if (!password()) return notice("Masukkan password dashboard terlebih dahulu.", "error");
  setBusy(true);
  try {
    const data = await api("/api/repos");
    renderRepos(data.repos || []);
    notice(`Berhasil memuat ${data.repos.length} repository.`, "ok");
  } catch (error) { notice(error.message, "error"); }
  finally { setBusy(false); }
}
function renderRepos(repos) {
  const root = $("repos");
  if (!repos.length) {
    root.className = "empty";
    root.innerHTML = "<span>⌘</span><strong>Belum ada repository</strong><small>Repository GitHub kamu akan tampil di sini.</small>";
    return;
  }
  root.className = "repo-list";
  root.replaceChildren();
  repos.forEach(repo => {
    const item = document.createElement("article");
    item.className = "repo";
    const symbol = document.createElement("div");
    symbol.className = "repo-symbol";
    symbol.textContent = "⑂";
    const info = document.createElement("div");
    info.className = "repo-info";
    const name = document.createElement("strong");
    name.textContent = repo.name + (repo.private ? "  🔒 PRIVATE" : "");
    const link = document.createElement("a");
    link.href = repo.html_url; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = repo.html_url;
    const date = document.createElement("small");
    date.textContent = "Diperbarui: " + new Date(repo.updated_at).toLocaleDateString("id-ID");
    info.append(name, link, date);
    const del = document.createElement("button");
    del.className = "delete"; del.textContent = "Hapus";
    del.addEventListener("click", () => deleteRepo(repo.name));
    item.append(symbol, info, del);
    root.append(item);
  });
}
async function deleteRepo(name) {
  if (!confirm(`Hapus repository "${name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`)) return;
  setBusy(true);
  try {
    await api("/api/repos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo: name }) });
    notice(`Repository ${name} berhasil dihapus.`, "ok");
    await loadRepos();
  } catch (error) { notice(error.message, "error"); }
  finally { setBusy(false); }
}
async function upload() {
  const repo = $("repo").value.trim();
  const file = $("zip").files[0];
  if (!password()) return notice("Hubungkan dashboard dengan password terlebih dahulu.", "error");
  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) return notice("Nama repository tidak valid.", "error");
  if (!file) return notice("Pilih file ZIP terlebih dahulu.", "error");
  if (!file.name.toLowerCase().endsWith(".zip")) return notice("File harus berformat ZIP.", "error");
  if (file.size > 4 * 1024 * 1024) return notice("Ukuran ZIP maksimal 4 MB.", "error");
  if (mode === "replace" && !confirm("Mode Ganti Semua akan menghapus file lama yang tidak ada di ZIP dari versi terbaru repository. Lanjutkan?")) return;

  const form = new FormData();
  form.append("repo", repo);
  form.append("file", file);
  form.append("mode", mode);
  form.append("private", String($("private").checked));

  setBusy(true);
  try {
    const result = await api("/api/import", { method: "POST", body: form });
    notice(`${result.message}. ${result.fileCount} file diproses. ${mode === "replace" ? "Isi repository lama diganti." : "File lama yang tidak ada di ZIP tetap dipertahankan."} ${result.url}`, "ok");
    $("zip").value = "";
    $("file-name").textContent = "Pilih file ZIP";
    $("file-size").textContent = "Klik untuk memilih file dari perangkat";
    await loadRepos();
  } catch (error) { notice(error.message, "error"); }
  finally { setBusy(false); }
}
document.querySelectorAll(".mode-card").forEach(button => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    document.querySelectorAll(".mode-card").forEach(card => {
      const active = card.dataset.mode === mode;
      card.classList.toggle("selected", active);
      card.classList.toggle("danger-mode", active && mode === "replace");
      card.querySelector(".mode-choice").textContent = active ? "✓ Dipilih" : "Pilih mode";
    });
    $("warning").classList.toggle("hidden", mode !== "replace");
  });
});
$("zip").addEventListener("change", event => {
  const file = event.target.files[0];
  $("file-name").textContent = file ? file.name : "Pilih file ZIP";
  $("file-size").textContent = file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Klik untuk memilih file dari perangkat";
});
$("connect").addEventListener("click", loadRepos);
$("refresh").addEventListener("click", loadRepos);
$("upload").addEventListener("click", upload);
$("password").addEventListener("keydown", event => { if (event.key === "Enter") loadRepos(); });