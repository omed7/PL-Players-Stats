from pathlib import Path

from PIL import Image

SOURCE = Path("assets/social/fpl-omed-social-source.png")
OUTPUT = Path("assets/social/fpl-omed-social.png")
TARGET_SIZE = (1200, 630)


def main():
    image = Image.open(SOURCE).convert("RGB")
    target_ratio = TARGET_SIZE[0] / TARGET_SIZE[1]
    source_ratio = image.width / image.height

    if source_ratio > target_ratio:
        crop_width = round(image.height * target_ratio)
        left = (image.width - crop_width) // 2
        image = image.crop((left, 0, left + crop_width, image.height))
    elif source_ratio < target_ratio:
        crop_height = round(image.width / target_ratio)
        top = (image.height - crop_height) // 2
        image = image.crop((0, top, image.width, top + crop_height))

    image.resize(TARGET_SIZE, Image.Resampling.LANCZOS).save(
        OUTPUT, format="PNG", optimize=True
    )


if __name__ == "__main__":
    main()
