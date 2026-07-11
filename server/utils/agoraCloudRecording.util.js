// utils/agoraCloudRecording.util.js
//
// Thin wrapper around Agora's Cloud Recording REST API, configured to
// dump the recorded voice note straight to your AWS S3 bucket. Docs:
// https://docs.agora.io/en/cloud-recording/reference/restful-api

const APP_ID = process.env.AGORAIO_APP_ID?.trim();
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID?.trim();
const CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET?.trim();

/**
 * A bare `400 invalid_appid`/`401` from Agora almost never means the request
 * body is malformed — it means the App ID in the URL and the Customer
 * ID/Secret in the Basic Auth header don't belong to the same Agora
 * project, or Cloud Recording isn't enabled as a feature on that project.
 * Fail fast with THAT diagnosis instead of a bare network error, and
 * without ever printing the actual secret values to logs.
 */
function assertConfigured() {
  const missing = [];
  if (!APP_ID) missing.push('AGORAIO_APP_ID');
  if (!CUSTOMER_ID) missing.push('AGORA_CUSTOMER_ID');
  if (!CUSTOMER_SECRET) missing.push('AGORA_CUSTOMER_SECRET');
  if (missing.length) {
    throw new Error(`Agora Cloud Recording is not configured — missing env var(s): ${missing.join(', ')}.`);
  }
  // Agora App IDs are always a 32-char lowercase hex string. Not a proof of
  // correctness, but catches the single most common copy-paste mistake
  // (truncated/extra characters, wrong value pasted into the wrong var).
  if (!/^[a-f0-9]{32}$/i.test(APP_ID)) {
    throw new Error('AGORAIO_APP_ID does not look like a valid Agora App ID (expected a 32-character hex string). Re-copy it from the Agora Console.');
  }
}

function authHeader() {
  const basic = Buffer.from(`${CUSTOMER_ID}:${CUSTOMER_SECRET}`).toString('base64');
  return { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' };
}

async function agoraPost(path, body) {
  assertConfigured();
  const res = await fetch(`https://api.agora.io/v1/apps/${APP_ID}${path}`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Surface Agora's specific `reason` field (e.g. "invalid_appid") loudly —
    // that string tells you exactly what to go check in the Console:
    //   - invalid_appid / no_such_appid  -> App ID and Customer ID/Secret
    //     were generated under DIFFERENT Agora projects, or Cloud Recording
    //     isn't enabled as a feature on this project yet.
    //   - invalid_customer_key / authentication failed -> Customer ID/Secret
    //     themselves are wrong or were regenerated (they invalidate the old
    //     pair when you regenerate).
    const reason = data?.reason || data?.message || JSON.stringify(data);
    throw new Error(
      `Agora Cloud Recording ${path} failed (${res.status}, reason: "${reason}"). ` +
        `Check in the Agora Console that AGORAIO_APP_ID and AGORA_CUSTOMER_ID/SECRET belong to the SAME project, and that Cloud Recording is enabled on it.`
    );
  }
  return data;
}

// Amazon S3 is consistently vendor code 1 across every Agora source.
const S3_VENDOR_CODE = 1;

// Agora defines its OWN numeric region codes for third-party storage —
// separate from AWS's region names — and we could not pull the full,
// current, authoritative table (it's rendered client-side on Agora's docs
// site, not scrapable). Community examples disagree with each other on
// specific values. DO NOT trust the default below blindly: look up your
// bucket's actual region code yourself at
// https://docs.agora.io/en/cloud-recording/reference/region-vendor
// and set AGORA_S3_REGION_CODE in your .env once confirmed.
const S3_REGION_CODE = Number(process.env.AGORA_S3_REGION_CODE ?? 0);

export async function acquireRecordingResource(channelName, recordingUid) {
  const data = await agoraPost('/cloud_recording/acquire', {
    cname: channelName,
    uid: String(recordingUid),
    clientRequest: { resourceExpiredHour: 1, scene: 0 },
  });
  return data.resourceId;
}

export async function startCloudRecording({ channelName, recordingUid, resourceId, token }) {
  const data = await agoraPost(`/cloud_recording/resourceid/${resourceId}/mode/mix/start`, {
    cname: channelName,
    uid: String(recordingUid),
    clientRequest: {
      token,
      recordingConfig: {
        channelType: 0, // Communication mode — a 1:1 voice note, not a live broadcast
        streamTypes: 0, // audio only — verify against your `agora-token`/Cloud Recording API version's enum if this errors
        maxIdleTime: 60,
        subscribeAudioUids: ['#allstream#'], // Agora's documented "subscribe to everyone" wildcard
      },
      recordingFileConfig: { avFileType: ['mp4'] },
      storageConfig: {
        vendor: S3_VENDOR_CODE,
        region: S3_REGION_CODE,
        bucket: process.env.AWS_BUCKET_NAME,
        accessKey: process.env.AWS_ACCESS_KEY_ID,
        secretKey: process.env.AWS_SECRET_ACCESS_KEY,
        fileNamePrefix: ['support-voice-notes'],
      },
    },
  });
  return data.sid;
}

/** Returns Agora's `serverResponse`, which — for a short recording like a
 * voice note — usually already includes `fileList` synchronously. */
export async function stopCloudRecording({ channelName, recordingUid, resourceId, sid }) {
  const data = await agoraPost(`/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`, {
    cname: channelName,
    uid: String(recordingUid),
    clientRequest: {},
  });
  return data.serverResponse;
}

export async function queryCloudRecording({ resourceId, sid }) {
  const res = await fetch(
    `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/query`,
    { headers: authHeader() }
  );
  const data = await res.json().catch(() => ({}));
  return data.serverResponse;
}