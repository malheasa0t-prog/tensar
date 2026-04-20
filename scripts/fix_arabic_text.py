"""Repair the Arabic copy in a promotional image by rebuilding the left panel."""

from __future__ import annotations

import argparse
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE_SIZE = (2528, 1684)
DEFAULT_INPUT = Path(r"C:\Users\m\Downloads\Gemini_Generated_Image_8jcspk8jcspk8jcs.jfif")
DEFAULT_OUTPUT = DEFAULT_INPUT.with_name("Gemini_Generated_Image_8jcspk8jcspk8jcs_fixed_arabic_v2.png")
BOLD_FONTS = (
    Path(r"C:\Windows\Fonts\segoeuib.ttf"),
    Path(r"C:\Windows\Fonts\tahomabd.ttf"),
    Path(r"C:\Windows\Fonts\arialbd.ttf"),
)
REGULAR_FONTS = (
    Path(r"C:\Windows\Fonts\segoeui.ttf"),
    Path(r"C:\Windows\Fonts\tahoma.ttf"),
    Path(r"C:\Windows\Fonts\arial.ttf"),
)


def build_parser() -> argparse.ArgumentParser:
    """Return the CLI parser."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser


def resolve_font_path(bold: bool = True) -> Path:
    """Return the first available font path."""

    candidates = BOLD_FONTS if bold else REGULAR_FONTS
    for font_path in candidates:
        if font_path.exists():
            return font_path
    raise FileNotFoundError("No supported font was found on this system.")


def validate_image_path(image_path: Path) -> Path:
    """Validate and resolve an image path."""

    resolved_path = image_path.expanduser().resolve()
    if not resolved_path.exists():
        raise FileNotFoundError(f"Input image was not found: {resolved_path}")
    if not resolved_path.is_file():
        raise ValueError(f"Input path is not a file: {resolved_path}")
    return resolved_path


def shape_rtl_text(text: str) -> str:
    """Shape Arabic text for Pillow rendering."""

    cleaned_text = text.strip()
    if not cleaned_text:
        raise ValueError("Text content must not be empty.")
    return get_display(arabic_reshaper.reshape(cleaned_text))


def scale_box(box: tuple[int, int, int, int], image_size: tuple[int, int]) -> tuple[int, int, int, int]:
    """Scale a base-size box to the current image size."""

    width, height = image_size
    if width <= 0 or height <= 0:
        raise ValueError("Image dimensions must be positive.")
    return (
        round(box[0] * width / BASE_SIZE[0]),
        round(box[1] * height / BASE_SIZE[1]),
        round(box[2] * width / BASE_SIZE[0]),
        round(box[3] * height / BASE_SIZE[1]),
    )


def scale_point(point: tuple[int, int], image_size: tuple[int, int]) -> tuple[int, int]:
    """Scale a base-size point to the current image size."""

    width, height = image_size
    if width <= 0 or height <= 0:
        raise ValueError("Image dimensions must be positive.")
    return (round(point[0] * width / BASE_SIZE[0]), round(point[1] * height / BASE_SIZE[1]))


def fit_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    box: tuple[int, int, int, int],
    font_path: Path,
    max_size: int,
    min_size: int,
    stroke_width: int = 0,
) -> ImageFont.FreeTypeFont:
    """Return the largest font that fits inside a box."""

    if min_size <= 0 or max_size < min_size:
        raise ValueError("Font size bounds are invalid.")
    box_width, box_height = box[2] - box[0], box[3] - box[1]
    for size in range(max_size, min_size - 1, -2):
        font = ImageFont.truetype(str(font_path), size=size)
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
        if right - left <= box_width and bottom - top <= box_height:
            return font
    return ImageFont.truetype(str(font_path), size=min_size)


def alpha_overlay(size: tuple[int, int], color: tuple[int, int, int, int]) -> Image.Image:
    """Create a transparent RGBA image."""

    return Image.new("RGBA", size, color)


def add_copy_panel(base_image: Image.Image) -> Image.Image:
    """Add a soft left-side gradient panel."""

    overlay = alpha_overlay(base_image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    solid_width = round(base_image.width * 0.36)
    fade_start = solid_width
    fade_end = round(base_image.width * 0.48)
    draw.rectangle((0, 0, solid_width, base_image.height), fill=(16, 6, 6, 242))
    for step in range(fade_start, fade_end, 10):
        progress = (step - fade_start) / max(fade_end - fade_start, 1)
        alpha = round(242 * (1 - progress) ** 1.8)
        draw.rectangle((step, 0, min(step + 18, fade_end), base_image.height), fill=(16, 6, 6, alpha))
    overlay = overlay.filter(ImageFilter.GaussianBlur(18))
    panel_mask = overlay.getchannel("A").filter(ImageFilter.GaussianBlur(8))
    blurred = base_image.filter(ImageFilter.GaussianBlur(10)).convert("RGBA")
    softened = Image.composite(blurred, base_image.convert("RGBA"), panel_mask)
    return Image.alpha_composite(softened, overlay)


def draw_glow_box(
    image: Image.Image,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int],
    radius: int,
    glow_alpha: int,
) -> None:
    """Draw a rounded rectangle with a soft glow."""

    glow = alpha_overlay(image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(box, radius=radius, fill=(255, 255, 255, glow_alpha))
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=3)


def draw_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    position: tuple[int, int],
    box: tuple[int, int, int, int],
    font_path: Path,
    max_size: int,
    min_size: int,
    fill: tuple[int, int, int],
    shadow_fill: tuple[int, int, int],
    anchor: str = "mm",
    stroke_width: int = 0,
    stroke_fill: tuple[int, int, int] | None = None,
    rtl: bool = True,
    display_text: str | None = None,
) -> None:
    """Draw one text block with a soft shadow."""

    rendered_text = display_text if display_text is not None else (shape_rtl_text(text) if rtl else text)
    font = fit_font(draw, rendered_text, box, font_path, max_size, min_size, stroke_width)
    shadow_xy = (position[0] + 3, position[1] + 4)
    draw.text(shadow_xy, rendered_text, font=font, fill=shadow_fill, anchor=anchor)
    kwargs = {"font": font, "fill": fill, "anchor": anchor}
    if stroke_fill is not None and stroke_width > 0:
        kwargs["stroke_width"] = stroke_width
        kwargs["stroke_fill"] = stroke_fill
    draw.text(position, rendered_text, **kwargs)


def draw_bullet_row(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    image_size: tuple[int, int],
    font_path: Path,
    check_font: Path,
) -> None:
    """Draw one Arabic bullet row with a check mark."""

    text_box = scale_box((180, y - 42, 760, y + 42), image_size)
    text_point = scale_point((720, y), image_size)
    check_point = scale_point((780, y), image_size)
    draw_text(draw, text, text_point, text_box, font_path, 56, 36, (246, 242, 240), (43, 16, 14), "ra", 2, (42, 15, 14))
    scale = max(round(20 * image_size[0] / BASE_SIZE[0]), 12)
    shadow = [(check_point[0] - scale, check_point[1] + 2), (check_point[0] - 2, check_point[1] + scale), (check_point[0] + scale * 2, check_point[1] - scale)]
    mark = [(check_point[0] - scale, check_point[1]), (check_point[0] - 2, check_point[1] + scale), (check_point[0] + scale * 2, check_point[1] - scale)]
    draw.line(shadow, fill=(53, 20, 18), width=max(scale // 3, 4), joint="curve")
    draw.line(mark, fill=(241, 236, 233), width=max(scale // 3, 4), joint="curve")


def process_image(input_path: Path, output_path: Path) -> Path:
    """Generate the repaired image and return the saved path."""

    source_path = validate_image_path(input_path)
    bold_font = resolve_font_path(True)
    regular_font = resolve_font_path(False)
    image = add_copy_panel(Image.open(source_path).convert("RGBA"))
    output_path.parent.mkdir(parents=True, exist_ok=True)

    tag_box = scale_box((325, 120, 770, 215), image.size)
    price_box = scale_box((118, 838, 760, 960), image.size)
    button_box = scale_box((210, 1550, 820, 1634), image.size)
    draw_glow_box(image, tag_box, (34, 13, 11, 210), (133, 83, 65, 140), 22, 34)
    draw_glow_box(image, price_box, (235, 232, 244, 228), (204, 194, 255, 170), 26, 46)
    draw_glow_box(image, button_box, (55, 57, 106, 232), (172, 184, 255, 160), 28, 40)

    draw = ImageDraw.Draw(image)
    draw_text(draw, "عرض خاص", scale_point((548, 168), image.size), tag_box, bold_font, 72, 44, (252, 249, 247), (49, 19, 17), "mm", 2, (55, 21, 19))
    draw_text(draw, "اشترك الآن في", scale_point((482, 335), image.size), scale_box((125, 248, 840, 402), image.size), bold_font, 96, 66, (238, 221, 209), (47, 18, 16), "mm", 2, (64, 26, 20))
    draw_text(draw, "ChatGPT Plus", scale_point((498, 458), image.size), scale_box((138, 390, 856, 528), image.size), bold_font, 92, 68, (240, 208, 181), (63, 25, 18), "mm", 2, (97, 50, 35), False)
    draw_text(draw, "لمدة شهر على حسابك الشخصي", scale_point((500, 585), image.size), scale_box((105, 540, 900, 628), image.size), bold_font, 62, 42, (248, 243, 241), (47, 18, 16), "mm", 2, (53, 20, 18))
    draw_text(draw, "تفعيل فوري وآمن على حسابك الشخصي", scale_point((502, 748), image.size), scale_box((110, 705, 900, 780), image.size), regular_font, 46, 34, (248, 244, 241), (43, 16, 14), "mm", 2, (45, 16, 15))
    price_display = f"[ 4.99$ {shape_rtl_text('شهريًا')} ]"
    draw_text(draw, "[ 4.99$ شهريًا ]", scale_point((438, 900), image.size), price_box, bold_font, 74, 46, (50, 43, 95), (243, 240, 252), "mm", 1, (245, 242, 255), False, price_display)

    bullet_font = bold_font
    check_font = bold_font
    draw_bullet_row(draw, "سرعة استجابة مذهلة", 1028, image.size, bullet_font, check_font)
    draw_bullet_row(draw, "أولوية الوصول إلى الميزات", 1122, image.size, bullet_font, check_font)
    draw_bullet_row(draw, "نموذج GPT الأقوى ذكاءً وقوةً", 1216, image.size, bullet_font, check_font)
    draw_bullet_row(draw, "إنشاء وتعديل الصور بلا حدود", 1310, image.size, bullet_font, check_font)
    draw_bullet_row(draw, "Codex: الأقوى للبرمجة وتوليد الكود", 1404, image.size, bullet_font, check_font)

    draw_text(draw, "طريقة الدفع: شام كاش", scale_point((500, 1466), image.size), scale_box((150, 1438, 855, 1504), image.size), bold_font, 50, 36, (238, 198, 162), (53, 20, 18), "mm", 2, (75, 35, 25))
    draw_text(draw, "الاشتراك مضمون طوال فترة الاشتراك", scale_point((500, 1508), image.size), scale_box((150, 1488, 860, 1546), image.size), regular_font, 34, 24, (248, 243, 241), (45, 16, 14), "mm", 2, (47, 17, 15))
    draw_text(draw, "اشترك الآن", scale_point((515, 1592), image.size), button_box, bold_font, 62, 44, (250, 248, 255), (34, 26, 63), "mm", 2, (29, 25, 59))
    draw_text(draw, "serva-s.com", scale_point((456, 1664), image.size), scale_box((210, 1646, 700, 1684), image.size), regular_font, 34, 24, (220, 214, 214), (45, 17, 15), "mm", 1, (41, 15, 14), False)

    image.convert("RGB").save(output_path, format="PNG", optimize=True)
    return output_path


def main() -> None:
    """Run the script entry point."""

    args = build_parser().parse_args()
    print(process_image(args.input, args.output))


if __name__ == "__main__":
    main()
