/* Supabase integration module for Mirror of Us.
   Supports media uploads, metadata logging, and gallery retrieval with signed URLs. */
(function () {
  const getEnvConfig = () => {
    const custom = window.__MIRROR_ENV_OVERRIDE__ || {};
    const base = window.__MIRROR_ENV__ || {};
    return {
      SUPABASE_URL: custom.SUPABASE_URL || base.SUPABASE_URL || "",
      SUPABASE_ANON_KEY: custom.SUPABASE_ANON_KEY || base.SUPABASE_ANON_KEY || ""
    };
  };

  let config = getEnvConfig();
  let client = window.supabase && config.SUPABASE_URL && config.SUPABASE_ANON_KEY
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;

  // Local storage mock registry so moments can be tested offline
  const MOCK_STORAGE_KEY = "mirror_mock_moments_v1";
  function getMockMoments() {
    try {
      return JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }
  function saveMockMoment(record) {
    const list = getMockMoments();
    list.unshift(record);
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (_) {}
  }

  window.mirrorStore = {
    get isMock() {
      return !client;
    },
    getClient() {
      return client;
    },
    reconfigure(newUrl, newKey) {
      if (newUrl && newKey && window.supabase) {
        config = { SUPABASE_URL: newUrl, SUPABASE_ANON_KEY: newKey };
        client = window.supabase.createClient(newUrl, newKey);
        return true;
      }
      return false;
    },

    async save(blob, fileType = "photo", metadata = {}) {
      const extension = fileType === "video" ? "webm" : "jpg";
      const now = new Date();
      const dateFolder = now.toISOString().slice(0, 10);
      const randomId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const path = `${dateFolder}/${randomId}.${extension}`;

      if (!client) {
        const objectUrl = URL.createObjectURL(blob);
        console.info("[Mirror of Us] Mock capture saved", { fileType, metadata, size: blob.size, path });
        const mockItem = {
          id: randomId,
          file_url: objectUrl,
          storage_path: path,
          file_type: fileType,
          detected_action: metadata.detectedAction || "low_movement",
          animation_shown: metadata.animationShown || "smile",
          created_at: now.toISOString(),
          mock: true
        };
        saveMockMoment(mockItem);
        return mockItem;
      }

      const { error: uploadError } = await client.storage
        .from("gf-moments")
        .upload(path, blob, {
          contentType: blob.type || "image/jpeg",
          upsert: false
        });
      if (uploadError) throw uploadError;

      const row = {
        file_url: path,
        file_type: fileType,
        detected_action: metadata.detectedAction || "low_movement",
        animation_shown: metadata.animationShown || "smile"
      };

      const { data: insertedData, error: rowError } = await client
        .from("moments")
        .insert(row)
        .select()
        .single();

      if (rowError) {
        console.warn("Storage upload succeeded but row insert error:", rowError);
        return { file_url: path, id: randomId };
      }

      return insertedData || { file_url: path, id: randomId };
    },

    async fetchMoments({ limit = 40, offset = 0, actionFilter = null } = {}) {
      if (!client) {
        let mock = getMockMoments();
        if (actionFilter && actionFilter !== "all") {
          mock = mock.filter(m => m.detected_action === actionFilter);
        }
        return mock.slice(offset, offset + limit);
      }

      let query = client
        .from("moments")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (actionFilter && actionFilter !== "all") {
        query = query.eq("detected_action", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getSignedPhotoUrl(path, expiresIn = 7200) {
      if (!client) return path; // In mock mode path is already an object URL
      if (!path) return "";
      // If path is already a full URL
      if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) {
        return path;
      }
      const { data, error } = await client.storage
        .from("gf-moments")
        .createSignedUrl(path, expiresIn);
      if (error) throw error;
      return data?.signedUrl || "";
    },

    async deleteMoment(id, path) {
      if (!client) {
        const remaining = getMockMoments().filter(m => m.id !== id && m.storage_path !== path);
        try {
          localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(remaining));
        } catch (_) {}
        return true;
      }
      if (path) {
        await client.storage.from("gf-moments").remove([path]);
      }
      if (id) {
        await client.from("moments").delete().eq("id", id);
      }
      return true;
    }
  };
})();
