import os
from pathlib import Path
from PIL import Image
import boto3 
from botocore.config import Config

# =========================
# CONFIG
# =========================

R2_ACCOUNT_ID="c76add5a92a8356009103a33d7104f5b"
R2_ACCESS_KEY_ID="5406321913216ff794489dce4ba53883"
R2_SECRET_ACCESS_KEY="0ebfaf738efa9a529090b7b2edbbb6b1d5fb6021788ff75b4567c1846cb01a37"


BUCKET_NAME = "rohq"

# R2 folder to process
R2_PREFIX = "posts/"

# Local output directory
LOCAL_OUTPUT_DIR = Path("./compressed")

# JPEG quality
JPEG_QUALITY = 80

# Maximum width/height
MAX_SIZE = 2000


# =========================
# R2 CLIENT
# =========================

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name="auto",
    config=Config(signature_version="s3v4"),
)


# =========================
# COMPRESS IMAGE
# =========================

def compress_image(input_path, output_path):
    with Image.open(input_path) as img:

        # Correct phone-photo orientation
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)

        # Resize while maintaining aspect ratio
        img.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)

        # JPEG doesn't support RGBA
        if img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, "white")

            if img.mode == "P":
                img = img.convert("RGBA")

            if img.mode in ("RGBA", "LA"):
                background.paste(
                    img,
                    mask=img.getchannel("A")
                )
                img = background
            else:
                img = img.convert("RGB")

        else:
            img = img.convert("RGB")

        output_path.parent.mkdir(parents=True, exist_ok=True)

        img.save(
            output_path,
            "JPEG",
            quality=JPEG_QUALITY,
            optimize=True,
            progressive=True
        )


# =========================
# DOWNLOAD + COMPRESS
# =========================

def process_image(r2_key):

    # Preserve folder structure
    # posts/user123/post456.jpg
    #
    # becomes
    #
    # compressed/posts/user123/post456.jpg

    local_original = LOCAL_OUTPUT_DIR / r2_key
    local_compressed = LOCAL_OUTPUT_DIR / r2_key

    local_original.parent.mkdir(parents=True, exist_ok=True)

    print(f"Downloading: {r2_key}")

    s3.download_file(
        BUCKET_NAME,
        r2_key,
        str(local_original)
    )

    # Temporary compressed file
    temp_path = local_compressed.with_suffix(".tmp.jpg")

    try:
        compress_image(
            local_original,
            temp_path
        )

        # Replace original local file
        temp_path.replace(local_compressed)

        original_size = local_original.stat().st_size
        compressed_size = local_compressed.stat().st_size

        print(
            f"  {original_size / 1024 / 1024:.2f} MB"
            f" -> "
            f"{compressed_size / 1024:.0f} KB"
        )

    except Exception as e:
        print(f"  ERROR: {e}")

        if temp_path.exists():
            temp_path.unlink()


# =========================
# MAIN
# =========================

def main():

    print(f"Scanning R2: {BUCKET_NAME}/{R2_PREFIX}")
    print(f"Output: {LOCAL_OUTPUT_DIR.absolute()}")
    print()

    paginator = s3.get_paginator("list_objects_v2")

    count = 0

    for page in paginator.paginate(
        Bucket=BUCKET_NAME,
        Prefix=R2_PREFIX
    ):

        for obj in page.get("Contents", []):

            key = obj["Key"]

            # Skip folders
            if key.endswith("/"):
                continue

            # Only process images
            extension = Path(key).suffix.lower()

            if extension not in (
                ".jpg",
                ".jpeg",
                ".png",
                ".webp"
            ):
                continue

            process_image(key)
            count += 1

    print()
    print(f"Done. Processed {count} images.")


if __name__ == "__main__":
    main()