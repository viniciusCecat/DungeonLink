#ifndef DUNGEONLINK_SECURITY_H
#define DUNGEONLINK_SECURITY_H

#include <Arduino.h>
#include <ctype.h>
#include <string.h>
#include "mbedtls/md.h"
#if __has_include("psa/crypto.h")
#include "psa/crypto.h"
#endif
#include "secrets.h"

namespace DungeonSecurity {

inline bool ensureCryptoReady() {
#if __has_include("psa/crypto.h")
  static bool initialized = false;
  if (!initialized) {
    if (psa_crypto_init() != PSA_SUCCESS) {
      return false;
    }
    initialized = true;
  }
#endif
  return true;
}

inline bool computeSha256(const uint8_t* data, size_t len, uint8_t out32[32]) {
  if (!ensureCryptoReady()) {
    return false;
  }
  const mbedtls_md_info_t* mdInfo = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (mdInfo == nullptr) {
    return false;
  }
  return mbedtls_md(mdInfo, data, len, out32) == 0;
}

// Calcula HMAC-SHA256 (RFC 2104) sobre mbedtls_md (compativel com MbedTLS 2.x/3.x/4.0)
// e retorna os primeiros 16 caracteres hexadecimais em minusculo (64 bits).
inline String computeHmacHex16(const String& message) {
  if (!ensureCryptoReady()) {
    return "";
  }
  const mbedtls_md_info_t* mdInfo = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (mdInfo == nullptr) {
    return "";
  }

  const uint8_t* key = reinterpret_cast<const uint8_t*>(BLE_AUTH_SECRET);
  size_t keyLen = strlen(BLE_AUTH_SECRET);

  uint8_t keyBlock[64];
  memset(keyBlock, 0, sizeof(keyBlock));
  if (keyLen > sizeof(keyBlock)) {
    if (!computeSha256(key, keyLen, keyBlock)) {
      return "";
    }
  } else {
    memcpy(keyBlock, key, keyLen);
  }

  uint8_t iKeyPad[64];
  uint8_t oKeyPad[64];
  for (size_t i = 0; i < 64; i++) {
    iKeyPad[i] = keyBlock[i] ^ 0x36;
    oKeyPad[i] = keyBlock[i] ^ 0x5c;
  }

  uint8_t innerHash[32];
  uint8_t hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);

  int rc = mbedtls_md_setup(&ctx, mdInfo, 0);
  if (rc == 0) rc = mbedtls_md_starts(&ctx);
  if (rc == 0) rc = mbedtls_md_update(&ctx, iKeyPad, sizeof(iKeyPad));
  if (rc == 0) rc = mbedtls_md_update(&ctx, reinterpret_cast<const uint8_t*>(message.c_str()), message.length());
  if (rc == 0) rc = mbedtls_md_finish(&ctx, innerHash);

  if (rc == 0) rc = mbedtls_md_starts(&ctx);
  if (rc == 0) rc = mbedtls_md_update(&ctx, oKeyPad, sizeof(oKeyPad));
  if (rc == 0) rc = mbedtls_md_update(&ctx, innerHash, sizeof(innerHash));
  if (rc == 0) rc = mbedtls_md_finish(&ctx, hmacResult);

  mbedtls_md_free(&ctx);

  if (rc != 0) {
    return "";
  }

  static const char hexDigits[] = "0123456789abcdef";
  char out[17];
  for (int i = 0; i < 8; i++) {
    out[i * 2]     = hexDigits[(hmacResult[i] >> 4) & 0x0F];
    out[i * 2 + 1] = hexDigits[hmacResult[i] & 0x0F];
  }
  out[16] = '\0';
  return String(out);
}

// Comparacao em tempo constante para mitigar ataques de temporizacao.
inline bool constantTimeHexEquals16(const String& provided, const String& expected) {
  if (provided.length() != 16 || expected.length() != 16) {
    return false;
  }
  uint8_t diff = 0;
  for (int i = 0; i < 16; i++) {
    uint8_t a = static_cast<uint8_t>(tolower(static_cast<unsigned char>(provided[i])));
    uint8_t b = static_cast<uint8_t>(expected[i]);
    diff |= (a ^ b);
  }
  return diff == 0;
}

inline String buildTxCanonical(
  const char* type,
  uint32_t seq,
  int dungeonId,
  const char* light,
  int ldrRaw,
  int ledState,
  const char* mode
) {
  String s;
  s.reserve(72);
  s += type;
  s += '|';
  s += String(seq);
  s += '|';
  s += String(dungeonId);
  s += '|';
  s += light;
  s += '|';
  s += String(ldrRaw);
  s += '|';
  s += String(ledState);
  s += '|';
  s += mode;
  return s;
}

inline String buildJoyCanonical(uint32_t seq, int jx, int jy, int btn) {
  String s;
  s.reserve(40);
  s += "joy|";
  s += String(seq);
  s += '|';
  s += String(jx);
  s += '|';
  s += String(jy);
  s += '|';
  s += String(btn);
  return s;
}

inline String buildRxCanonical(
  const char* type,
  uint32_t seq,
  const char* action,
  const char* arg
) {
  String s;
  s.reserve(64);
  s += type;
  s += '|';
  s += String(seq);
  s += '|';
  s += action;
  s += '|';
  s += arg;
  return s;
}

inline bool verifyRxSignature(
  const char* type,
  uint32_t seq,
  const char* action,
  const char* arg,
  const String& providedMac
) {
  String canonical = buildRxCanonical(type, seq, action, arg);
  String expected = computeHmacHex16(canonical);
  return constantTimeHexEquals16(providedMac, expected);
}

} // namespace DungeonSecurity

#endif
