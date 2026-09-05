/* Supabase upload client for Mirror of Us.
   Uploads moments directly to private Supabase storage and records metadata.
   Client has zero read/list permissions; captures are viewable only in Supabase Dashboard. */
(function () {
  const config = window.__MIRROR_ENV__ || {};
  const url = config.SUPABASE_URL || "";
  const key = config.SUPABASE_ANON_KEY || "";
  const client = window.supabase && url && key ? window.supabase.createClient(url, key) : null;

  window.mirrorStore = {
    get isMock() {
      return !client;
    },
    async save(blob, fileType = "photo", metadata = {}) {
      if (!client) {
        console.info("[Mirror of Us] Mock capture (no Supabase keys)", { fileType, metadata, size: blob.size });
        return { file_url: "mock-url", mock: true };
      }

      const extension = fileType === "video" ? "webm" : "jpg";
      const now = new Date();
      const dateFolder = now.toISOString().slice(0, 10);
      const randomId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const path = `${dateFolder}/${randomId}.${extension}`;

      // Upload to private bucket 'gf-moments'
      const { error: uploadError } = await client.storage
        .from("gf-moments")
        .upload(path, blob, {
          contentType: blob.type || "image/jpeg",
          upsert: false
        });
      if (uploadError) throw uploadError;

      // Insert metadata into table 'moments'
      const { error: rowError } = await client
        .from("moments")
        .insert({
          file_url: path,
          file_type: fileType,
          detected_action: metadata.detectedAction || "low_movement",
          animation_shown: metadata.animationShown || "smile"
        });

      if (rowError) {
        console.warn("[Mirror of Us] Storage saved, row log warning:", rowError);
      }

      return { file_url: path };
    }
  };
})();
