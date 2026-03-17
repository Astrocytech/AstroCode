import hashlib
import sys

import base58
from Crypto.Cipher import AES
from ecdsa import SigningKey
from ecdsa import ellipticcurve
from ecdsa.curves import Curve

# Certicom secp256-k1
_a = 0x0000000000000000000000000000000000000000000000000000000000000000
_b = 0x0000000000000000000000000000000000000000000000000000000000000007
_p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
_Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
_Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
_r = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141

# AES key (256-bit) as hex → bytes
_AES_KEY = bytes.fromhex("00112233445566778899AABBCCDDEEFF")

# Snapshots
_ORIG = {"a": _a, "b": _b, "p": _p, "Gx": _Gx, "Gy": _Gy, "r": _r}
_ORIG_AES_KEY = _AES_KEY

# --- Curve utilities ---
def _rebuild_curve_objects():
    global curve_secp256k1, generator_secp256k1, SECP256k1
    curve_secp256k1 = ellipticcurve.CurveFp(_p, _a, _b, 1)
    generator_secp256k1 = ellipticcurve.PointJacobi(
        curve_secp256k1, _Gx, _Gy, 1, _r, generator=True
    )
    SECP256k1 = Curve(
        "SECP256k1", curve_secp256k1, generator_secp256k1, (1, 3, 132, 0, 10), "secp256k1"
    )

def _validate_params(Gx: int, Gy: int, b: int, p: int):
    if not (0 <= Gx < p and 0 <= Gy < p):
        raise ValueError("Gx and Gy must be in [0, p).")
    if (b % p) == 0:
        raise ValueError("Invalid curve: b ≡ 0 mod p makes the curve singular.")
    lhs = pow(Gy, 2, p)
    rhs = (pow(Gx, 3, p) + (_a * Gx) + b) % p
    if lhs != rhs:
        raise ValueError("Generator (Gx,Gy) not on curve with given b and p.")

def set_curve_params(Gx=None, Gy=None, b=None, p=None, *, recompute_b_if_needed=True):
    global _Gx, _Gy, _b, _p
    new_Gx = _Gx if Gx is None else int(Gx)
    new_Gy = _Gy if Gy is None else int(Gy)
    new_p = _p if p is None else int(p)
    new_b = _b if b is None else int(b)
    if recompute_b_if_needed:
        lhs = pow(new_Gy, 2, new_p)
        rhs = (pow(new_Gx, 3, new_p) + (_a * new_Gx) + new_b) % new_p
        if lhs != rhs:
            new_b = (lhs - pow(new_Gx, 3, new_p) - (_a * new_Gx)) % new_p
            if new_b == 0:
                new_b = 1
    _validate_params(new_Gx, new_Gy, new_b, new_p)
    _Gx, _Gy, _b, _p = new_Gx, new_Gy, new_b, new_p
    _rebuild_curve_objects()
    return get_curve_params()

def reset_curve_params():
    return set_curve_params(
        Gx=_ORIG["Gx"], Gy=_ORIG["Gy"], b=_ORIG["b"], p=_ORIG["p"], recompute_b_if_needed=False
    )

def get_curve_params():
    return {"a": hex(_a), "b": hex(_b), "p": hex(_p), "Gx": hex(_Gx), "Gy": hex(_Gy), "r": hex(_r)}

_rebuild_curve_objects()

# --- AES Key utilities ---
def get_aes_key():
    return _AES_KEY.hex().upper()

def set_aes_key(key_hex: str):
    global _AES_KEY
    key_bytes = bytes.fromhex(key_hex)
    if len(key_bytes) not in (16, 24, 32):
        raise ValueError("AES key must be 16, 24, or 32 bytes.")
    _AES_KEY = key_bytes
    return get_aes_key()

def reset_aes_key():
    global _AES_KEY
    _AES_KEY = _ORIG_AES_KEY
    return get_aes_key()

# --- Address helpers ---
def private_key_to_address_original(private_key_hex):
    try:
        private_key_bytes = bytes.fromhex(private_key_hex)
        sk = SigningKey.from_string(private_key_bytes, curve=SECP256k1)
        vk = sk.get_verifying_key()
        public_key_bytes = vk.to_string("compressed")
        sha256_hash = hashlib.sha256(public_key_bytes).digest()
        ripemd160_hash = hashlib.new("ripemd160")
        ripemd160_hash.update(sha256_hash)
        hashed_public_key = ripemd160_hash.digest()
        hashed_public_key_with_version = b"\x00" + hashed_public_key
        checksum = hashlib.sha256(
            hashlib.sha256(hashed_public_key_with_version).digest()
        ).digest()[:4]
        binary_address = hashed_public_key_with_version + checksum
        return base58.b58encode(binary_address).decode("utf-8")
    except:
        return ""

def append_to_file(param, private_key_hex):
    filename = f"{param}.txt"
    with open(filename, "a", encoding="utf-8") as f:
        f.write(private_key_hex + "\n")

def narrower(private_key_hex):
    private_key_bytes = bytes.fromhex(private_key_hex)
    sk = SigningKey.from_string(private_key_bytes, curve=SECP256k1)
    vk = sk.get_verifying_key()
    public_key_bytes = vk.to_string("compressed")
    sha256_hash = hashlib.sha256(public_key_bytes).digest()
    ripemd160_hash = hashlib.new("ripemd160")
    ripemd160_hash.update(sha256_hash)
    hashed_public_key = ripemd160_hash.digest()
    hashed_public_key_with_version = b"\x00" + hashed_public_key
    checksum = hashlib.sha256(
        hashlib.sha256(hashed_public_key_with_version).digest()
    ).digest()[:4]
    binary_address = hashed_public_key_with_version + checksum
    address = binary_address.hex()[2:].upper()
    if address == "105B7F253F0EBD7843ADAEBBD805C944BFB863E417C8982D":
        append_to_file("KEY.txt", private_key_hex)
        sys.exit(0)
    return address

def public_key_to_hex(public_key):
    try:
        binary_address = base58.b58decode(public_key)
        if len(binary_address) != 25:
            raise ValueError("Invalid address length")
        hashed_public_key_with_checksum = binary_address[1:]
        return hashed_public_key_with_checksum.hex().upper()
    except Exception as e:
        return f"Error: {e}"

def hex_to_address(address_hex, version_byte=b"\x00"):
    try:
        hashed_pubkey_with_checksum = bytes.fromhex(address_hex)
        if len(hashed_pubkey_with_checksum) != 24:
            raise ValueError("Invalid address hex length")
        full_binary_address = version_byte + hashed_pubkey_with_checksum
        return base58.b58encode(full_binary_address).decode("utf-8")
    except Exception as e:
        return f"Error: {e}"

# --- Encryption/Decryption for 48-hex <-> 64-hex ---
def _pkcs7_pad(data: bytes, block_size: int = 16) -> bytes:
    pad_len = block_size - (len(data) % block_size)
    return data + bytes([pad_len] * pad_len)

def _pkcs7_unpad(data: bytes) -> bytes:
    pad_len = data[-1]
    if pad_len < 1 or pad_len > 16:
        raise ValueError("Invalid padding")
    return data[:-pad_len]

def narrower_64(hex48: str) -> str:
    raw24 = bytes.fromhex(hex48)
    if len(raw24) != 24:
        raise ValueError("Expected 24-byte input (48 hex characters).")
    padded = _pkcs7_pad(raw24, 16)
    cipher = AES.new(_AES_KEY, AES.MODE_ECB)
    return cipher.encrypt(padded).hex().upper()

def decrypt(hex64: str) -> str:
    raw32 = bytes.fromhex(hex64)
    if len(raw32) != 32:
        raise ValueError("Expected 32-byte input (64 hex characters).")
    cipher = AES.new(_AES_KEY, AES.MODE_ECB)
    decrypted = cipher.decrypt(raw32)
    unpadded = _pkcs7_unpad(decrypted)
    if len(unpadded) != 24:
        raise ValueError("Decryption did not yield original 24 bytes.")
    return unpadded.hex().upper()

print(public_key_to_hex("1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU"))

# print(private_key_to_address_original("0000000000000000000000000000000000000000000000456789ABCDEF012345"))
print(public_key_to_hex(private_key_to_address_original("00000000000000000000000000000000000000000000005E48C091C1A70C9A72")))