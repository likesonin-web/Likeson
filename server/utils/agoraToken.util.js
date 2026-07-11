// utils/agoraToken.util.js
//
// Generates a short-lived RTC token so a browser client can join a
// temporary, single-use channel to record a voice note (see
// agoraCloudRecording.util.js for the recording side of this).
//
// Requires the `agora-token` package (the actively-maintained replacement
// for the now-deprecated `agora-access-token`):
//   npm install agora-token

import pkg from 'agora-token';

const { RtcTokenBuilder, RtcRole } = pkg;

const APP_ID = process.env.AGORAIO_APP_ID?.trim();
const APP_CERT = process.env.AGORAIO_APP_CERT?.trim();
const EXPIRE_SEC = Number(process.env.AGORA_TOKEN_EXPIRE_SEC || 3600);

/**
 * @param {string} channelName
 * @param {number} uid - numeric Agora uid (not your app's user id)
 * @param {'publisher'|'subscriber'} roleName
 */
export function buildRtcToken(channelName, uid, roleName = 'publisher') {
  if (!APP_ID || !APP_CERT) {
    throw new Error('AGORAIO_APP_ID / AGORAIO_APP_CERT are not configured.');
  }
  const role = roleName === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
  const now = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = now + EXPIRE_SEC;

  // NOTE: `agora-token` ships more than one token-builder API across
  // versions (the classic absolute-timestamp signature used below, and a
  // newer relative-seconds signature on some releases' `RtcTokenBuilder2`).
  // If your installed version rejects this call, check its README for the
  // exact signature it expects — this is the one consistently shown across
  // Agora's own sample repos as of writing.
  return RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERT, channelName, uid, role, privilegeExpiredTs);
}

export { APP_ID };