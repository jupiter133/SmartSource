"""Generates Shopify product-import CSVs for the refurbished catalog.

Run: python3 sample-data/build_catalog.py
Prices are rough estimates: 'Good' grade = launch price x age factor x brand factor.
Edit FACTOR / BRAND or the model lists, then re-run.
"""
import csv, os

YEAR = 2026
OUT = os.path.dirname(os.path.abspath(__file__))
# share of launch price a 'Good' unit sells for, by age in years
FACTOR = {0: .85, 1: .72, 2: .60, 3: .50, 4: .42, 5: .36, 6: .31, 7: .27, 8: .24, 9: .22, 10: .20}
GRADES = [("Fair", .90), ("Good", 1.0), ("Excellent", 1.12), ("Premium", 1.25)]
GRADES_NO_PREMIUM = GRADES[:3]
COLS = ["Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
        "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value",
        "Variant SKU", "Variant Grams", "Variant Inventory Tracker", "Variant Inventory Policy",
        "Variant Fulfillment Service", "Variant Price", "Variant Compare At Price",
        "Variant Requires Shipping", "Variant Taxable", "Status"]


def handle(name):
    h = "".join(c if c.isalnum() else "-" for c in name.lower().replace("+", " plus"))
    while "--" in h:
        h = h.replace("--", "-")
    return h.strip("-")


def good_price(launch, year, brand):
    return launch * FACTOR[min(YEAR - year, 10)] * brand


def write(filename, products):
    """products: dicts with name, vendor, type, tags, body, year, brand, grades,
    opt2 (name), opt3 (name), and combos: list of (opt2 value, opt3 value, launch price)."""
    rows, nvar = [], 0
    for p in products:
        h = handle(p["name"])
        base = min(c[2] for c in p["combos"])
        good = good_price(base, p["year"], p["brand"])
        first = True
        for grade, mult in p["grades"]:
            for o2, o3, launch in p["combos"]:
                price = round(good * mult + (launch - base) * 0.45) - 0.01
                sku = f"{h}-{o2}-{o3}-{grade}".upper().replace("+", "PLUS")
                sku = "".join(c for c in sku if c.isalnum() or c == "-")
                rows.append([h, p["name"], p["body"] if first else "", p["vendor"] if first else "",
                             p["type"] if first else "", p["tags"] if first else "", "TRUE" if first else "",
                             "Condition", grade, p["opt2"], o2, p["opt3"], o3,
                             sku, p.get("grams", 300), "", "deny", "manual",
                             f"{price:.2f}", f"{launch:.2f}", "TRUE", "TRUE", "draft" if first else ""])
                first = False
                nvar += 1
    with open(os.path.join(OUT, filename), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(COLS)
        w.writerows(rows)
    print(f"{filename}: {len(products)} products, {nvar} variants, max {max(len(p['grades']) * len(p['combos']) for p in products)} per product")


def matrix(prices, colors):
    """prices: [(storage, launch)] x colors -> combos"""
    return [(s, c, pr) for s, pr in prices for c in colors]


# ---------------------------------------------------------------- Samsung phones
SAM_BODY = "<p>{n}, unlocked. Professionally refurbished, tested on up to 100 points, wiped and reset. 1-year warranty and free 30-day returns.</p><p><strong>Premium</strong> grade includes a brand-new battery.</p>"
samsung = [
    # name, year, [(storage, launch)], colors
    ("Galaxy S21", 2021, [("128GB", 799), ("256GB", 849)], ["Phantom Gray", "Phantom White", "Phantom Violet", "Phantom Pink"]),
    ("Galaxy S21+", 2021, [("128GB", 999), ("256GB", 1049)], ["Phantom Black", "Phantom Silver", "Phantom Violet"]),
    ("Galaxy S21 Ultra", 2021, [("128GB", 1199), ("256GB", 1249), ("512GB", 1379)], ["Phantom Black", "Phantom Silver"]),
    ("Galaxy S21 FE", 2022, [("128GB", 699), ("256GB", 769)], ["Graphite", "White", "Olive", "Lavender"]),
    ("Galaxy S22", 2022, [("128GB", 799), ("256GB", 849)], ["Phantom Black", "Phantom White", "Green", "Pink Gold"]),
    ("Galaxy S22+", 2022, [("128GB", 999), ("256GB", 1049)], ["Phantom Black", "Phantom White", "Green", "Pink Gold"]),
    ("Galaxy S22 Ultra", 2022, [("128GB", 1199), ("256GB", 1299), ("512GB", 1399), ("1TB", 1599)], ["Phantom Black", "Phantom White", "Burgundy", "Green"]),
    ("Galaxy S23", 2023, [("128GB", 799), ("256GB", 859)], ["Phantom Black", "Cream", "Green", "Lavender"]),
    ("Galaxy S23+", 2023, [("256GB", 999), ("512GB", 1119)], ["Phantom Black", "Cream", "Green", "Lavender"]),
    ("Galaxy S23 Ultra", 2023, [("256GB", 1199), ("512GB", 1379), ("1TB", 1619)], ["Phantom Black", "Cream", "Green", "Lavender"]),
    ("Galaxy S23 FE", 2023, [("128GB", 599), ("256GB", 659)], ["Mint", "Cream", "Graphite", "Purple"]),
    ("Galaxy S24", 2024, [("128GB", 799), ("256GB", 859)], ["Onyx Black", "Marble Gray", "Cobalt Violet", "Amber Yellow"]),
    ("Galaxy S24+", 2024, [("256GB", 999), ("512GB", 1119)], ["Onyx Black", "Marble Gray", "Cobalt Violet", "Amber Yellow"]),
    ("Galaxy S24 Ultra", 2024, [("256GB", 1299), ("512GB", 1419), ("1TB", 1659)], ["Titanium Black", "Titanium Gray", "Titanium Violet", "Titanium Yellow"]),
    ("Galaxy S24 FE", 2024, [("128GB", 649), ("256GB", 709)], ["Blue", "Graphite", "Gray", "Mint", "Yellow"]),
    ("Galaxy S25", 2025, [("128GB", 799), ("256GB", 859)], ["Navy", "Icyblue", "Silver Shadow", "Mint"]),
    ("Galaxy S25+", 2025, [("256GB", 999), ("512GB", 1119)], ["Navy", "Icyblue", "Silver Shadow", "Mint"]),
    ("Galaxy S25 Ultra", 2025, [("256GB", 1299), ("512GB", 1419), ("1TB", 1659)], ["Titanium Silverblue", "Titanium Black", "Titanium Whitesilver", "Titanium Gray"]),
    ("Galaxy S25 Edge", 2025, [("256GB", 1099), ("512GB", 1219)], ["Titanium Silver", "Titanium Jetblack", "Titanium Icyblue"]),
    ("Galaxy S25 FE", 2025, [("128GB", 649), ("256GB", 709)], ["Navy", "Icyblue", "Jetblack", "White"]),
    ("Galaxy Z Flip5", 2023, [("256GB", 999), ("512GB", 1119)], ["Mint", "Graphite", "Cream", "Lavender"]),
    ("Galaxy Z Fold5", 2023, [("256GB", 1799), ("512GB", 1919), ("1TB", 2159)], ["Icy Blue", "Phantom Black", "Cream"]),
    ("Galaxy Z Flip6", 2024, [("256GB", 1099), ("512GB", 1219)], ["Blue", "Mint", "Silver Shadow", "Yellow"]),
    ("Galaxy Z Fold6", 2024, [("256GB", 1899), ("512GB", 2019), ("1TB", 2259)], ["Silver Shadow", "Pink", "Navy"]),
    ("Galaxy Z Flip7", 2025, [("256GB", 1099), ("512GB", 1219)], ["Blue Shadow", "Jetblack", "Coralred", "Mint"]),
    ("Galaxy Z Fold7", 2025, [("256GB", 1999), ("512GB", 2119), ("1TB", 2419)], ["Blue Shadow", "Silver Shadow", "Jetblack"]),
    ("Galaxy A15 5G", 2024, [("128GB", 199)], ["Blue Black", "Light Blue"]),
    ("Galaxy A16 5G", 2024, [("128GB", 199)], ["Black", "Light Gray", "Light Green"]),
    ("Galaxy A35 5G", 2024, [("128GB", 399)], ["Awesome Navy", "Awesome Iceblue", "Awesome Lilac"]),
    ("Galaxy A36 5G", 2025, [("128GB", 399), ("256GB", 459)], ["Awesome Black", "Awesome Lavender", "Awesome White"]),
    ("Galaxy A54 5G", 2023, [("128GB", 449)], ["Awesome Black", "Awesome White", "Awesome Violet"]),
]
write("samsung-phones-shopify-import.csv", [dict(
    name=f"Samsung {n}", vendor="Samsung", type="Smartphone", year=y, brand=.75, grades=GRADES, grams=200,
    tags="condition:refurbished, Samsung, Samsung Galaxy, Android, Smartphones, unlocked" + (", Foldable" if " Z " in f" {n} " else ""),
    body=SAM_BODY.format(n=f"Samsung {n}"), opt2="Storage", opt3="Color", combos=matrix(st, cols))
    for n, y, st, cols in samsung])

# ---------------------------------------------------------------- iPads
IPAD_BODY = "<p>{n}. Professionally refurbished, tested on up to 100 points, wiped and reset. Cellular models are unlocked. 1-year warranty and free 30-day returns.</p><p><strong>Premium</strong> grade includes a brand-new battery.</p>"
ipads = [
    # name, year, [(storage, wifi launch)], cellular upcharge, colors
    ("iPad (9th gen)", 2021, [("64GB", 329), ("256GB", 479)], 130, ["Space Gray", "Silver"]),
    ("iPad (10th gen)", 2022, [("64GB", 449), ("256GB", 599)], 150, ["Blue", "Pink", "Yellow", "Silver"]),
    ("iPad (A16)", 2025, [("128GB", 349), ("256GB", 449), ("512GB", 649)], 150, ["Blue", "Pink", "Yellow", "Silver"]),
    ("iPad mini (6th gen)", 2021, [("64GB", 499), ("256GB", 649)], 150, ["Space Gray", "Pink", "Purple", "Starlight"]),
    ("iPad mini (A17 Pro)", 2024, [("128GB", 499), ("256GB", 599), ("512GB", 799)], 150, ["Space Gray", "Blue", "Purple", "Starlight"]),
    ("iPad Air (5th gen, M1)", 2022, [("64GB", 599), ("256GB", 749)], 150, ["Space Gray", "Starlight", "Pink", "Purple", "Blue"]),
    ("iPad Air 11-inch (M2)", 2024, [("128GB", 599), ("256GB", 699), ("512GB", 899), ("1TB", 1099)], 150, ["Space Gray", "Blue", "Purple", "Starlight"]),
    ("iPad Air 13-inch (M2)", 2024, [("128GB", 799), ("256GB", 899), ("512GB", 1099), ("1TB", 1299)], 150, ["Space Gray", "Blue", "Purple", "Starlight"]),
    ("iPad Air 11-inch (M3)", 2025, [("128GB", 599), ("256GB", 699), ("512GB", 899), ("1TB", 1099)], 150, ["Space Gray", "Blue", "Purple", "Starlight"]),
    ("iPad Air 13-inch (M3)", 2025, [("128GB", 799), ("256GB", 899), ("512GB", 1099), ("1TB", 1299)], 150, ["Space Gray", "Blue", "Purple", "Starlight"]),
    ("iPad Pro 11-inch (4th gen, M2)", 2022, [("128GB", 799), ("256GB", 899), ("512GB", 1099), ("1TB", 1499), ("2TB", 1899)], 200, ["Space Gray", "Silver"]),
    ("iPad Pro 12.9-inch (6th gen, M2)", 2022, [("128GB", 1099), ("256GB", 1199), ("512GB", 1399), ("1TB", 1799), ("2TB", 2199)], 200, ["Space Gray", "Silver"]),
    ("iPad Pro 11-inch (M4)", 2024, [("256GB", 999), ("512GB", 1199), ("1TB", 1599), ("2TB", 1999)], 200, ["Space Black", "Silver"]),
    ("iPad Pro 13-inch (M4)", 2024, [("256GB", 1299), ("512GB", 1499), ("1TB", 1899), ("2TB", 2299)], 200, ["Space Black", "Silver"]),
]
write("ipads-shopify-import.csv", [dict(
    name=n, vendor="Apple", type="Tablet", year=y, brand=.85, grades=GRADES, grams=600,
    tags="condition:refurbished, iPad, Apple, Tablets", body=IPAD_BODY.format(n=n), opt2="Storage", opt3="Color",
    combos=[(f"{s} {conn}", c, pr + (cell if conn != "Wi-Fi" else 0)) for s, pr in st for conn in ("Wi-Fi", "Wi-Fi + Cellular") for c in cols])
    for n, y, st, cell, cols in ipads])

# ---------------------------------------------------------------- Samsung tablets
TAB_BODY = "<p>Samsung {n}, Wi-Fi. Professionally refurbished, tested on up to 100 points, wiped and reset. 1-year warranty and free 30-day returns.</p><p><strong>Premium</strong> grade includes a brand-new battery.</p>"
tabs = [
    ("Galaxy Tab S8", 2022, [("128GB", 699), ("256GB", 779)], ["Graphite", "Silver", "Pink Gold"]),
    ("Galaxy Tab S8+", 2022, [("128GB", 899), ("256GB", 979)], ["Graphite", "Silver", "Pink Gold"]),
    ("Galaxy Tab S8 Ultra", 2022, [("128GB", 1099), ("256GB", 1199), ("512GB", 1399)], ["Graphite"]),
    ("Galaxy Tab S9", 2023, [("128GB", 799), ("256GB", 919)], ["Graphite", "Beige"]),
    ("Galaxy Tab S9+", 2023, [("256GB", 999), ("512GB", 1119)], ["Graphite", "Beige"]),
    ("Galaxy Tab S9 Ultra", 2023, [("256GB", 1199), ("512GB", 1319), ("1TB", 1619)], ["Graphite", "Beige"]),
    ("Galaxy Tab S9 FE", 2023, [("128GB", 449), ("256GB", 519)], ["Gray", "Silver", "Lavender", "Mint"]),
    ("Galaxy Tab S9 FE+", 2023, [("128GB", 599), ("256GB", 699)], ["Gray", "Silver", "Lavender", "Mint"]),
    ("Galaxy Tab S10+", 2024, [("256GB", 999), ("512GB", 1119)], ["Moonstone Gray", "Platinum Silver"]),
    ("Galaxy Tab S10 Ultra", 2024, [("256GB", 1199), ("512GB", 1319), ("1TB", 1619)], ["Moonstone Gray", "Platinum Silver"]),
    ("Galaxy Tab S10 FE", 2025, [("128GB", 499), ("256GB", 579)], ["Gray", "Silver", "Blue"]),
    ("Galaxy Tab S10 FE+", 2025, [("128GB", 649), ("256GB", 749)], ["Gray", "Silver", "Blue"]),
    ("Galaxy Tab A9+", 2023, [("64GB", 219), ("128GB", 269)], ["Graphite", "Silver", "Navy"]),
]
write("samsung-tablets-shopify-import.csv", [dict(
    name=f"Samsung {n}", vendor="Samsung", type="Tablet", year=y, brand=.75, grades=GRADES, grams=600,
    tags="condition:refurbished, Samsung, Galaxy Tab, Android Tablet, Tablets", body=TAB_BODY.format(n=n),
    opt2="Storage", opt3="Color", combos=matrix(st, cols)) for n, y, st, cols in tabs])

# ---------------------------------------------------------------- Consoles
CON_BODY = "<p>{n}. Professionally refurbished and tested: every port, drive and button checked, factory reset. Includes one controller (if originally bundled), power and HDMI cable. 1-year warranty and free 30-day returns.</p>"
consoles = [
    # name, year, brand factor, family tag, [(edition, color, launch)]
    ("PlayStation 4 Slim", 2016, 1.6, "PlayStation", [("500GB", "Jet Black", 299), ("1TB", "Jet Black", 349)]),
    ("PlayStation 4 Pro", 2016, 1.6, "PlayStation", [("1TB", "Jet Black", 399)]),
    ("PlayStation 5", 2020, 1.6, "PlayStation", [("Disc Edition 825GB", "White", 499), ("Digital Edition 825GB", "White", 399)]),
    ("PlayStation 5 Slim", 2023, 1.3, "PlayStation", [("Disc Edition 1TB", "White", 499), ("Digital Edition 1TB", "White", 449)]),
    ("PlayStation 5 Pro", 2024, 1.15, "PlayStation", [("2TB Digital", "White", 699)]),
    ("Xbox Series X", 2020, 1.5, "Xbox", [("1TB Disc", "Carbon Black", 499), ("1TB Digital", "Robot White", 449), ("2TB Disc", "Galaxy Black", 599)]),
    ("Xbox Series S", 2020, 1.5, "Xbox", [("512GB", "Robot White", 299), ("1TB", "Carbon Black", 349)]),
    ("Nintendo Switch", 2019, 1.6, "Nintendo", [("32GB", "Neon Red/Blue", 299), ("32GB", "Gray", 299)]),
    ("Nintendo Switch OLED", 2021, 1.5, "Nintendo", [("64GB", "White", 349), ("64GB", "Neon Red/Blue", 349)]),
    ("Nintendo Switch Lite", 2019, 1.6, "Nintendo", [("32GB", c, 199) for c in ["Yellow", "Gray", "Turquoise", "Coral", "Blue"]]),
    ("Nintendo Switch 2", 2025, 1.05, "Nintendo", [("Standard 256GB", "Black", 449), ("Mario Kart World Bundle 256GB", "Black", 499)]),
    ("Steam Deck OLED", 2023, 1.25, "Handheld", [("512GB", "Black", 549), ("1TB", "Black", 649)]),
]
write("consoles-shopify-import.csv", [dict(
    name=n, vendor=n.split()[0].replace("PlayStation", "Sony").replace("Xbox", "Microsoft").replace("Steam", "Valve"),
    type="Game console", year=y, brand=b, grades=GRADES_NO_PREMIUM, grams=4000,
    tags=f"condition:refurbished, Consoles, Gaming, {fam}", body=CON_BODY.format(n=n),
    opt2="Edition", opt3="Color", combos=combos) for n, y, b, fam, combos in consoles])

# ---------------------------------------------------------------- Apple Watch
W_BODY = "<p>{n}. Professionally refurbished, tested on up to 100 points, unpaired and reset. Cellular models are unlocked. 1-year warranty and free 30-day returns.</p><p><strong>Premium</strong> grade includes a brand-new battery.</p>"
watches = [
    # name, year, [(size, GPS launch)], cellular upcharge (None = cellular only), colors
    ("Apple Watch Series 7", 2021, [("41mm", 399), ("45mm", 429)], 100, ["Midnight", "Starlight", "Green", "Blue", "(PRODUCT)RED"]),
    ("Apple Watch SE (2nd gen)", 2022, [("40mm", 249), ("44mm", 279)], 50, ["Midnight", "Starlight", "Silver"]),
    ("Apple Watch Series 8", 2022, [("41mm", 399), ("45mm", 429)], 100, ["Midnight", "Starlight", "Silver", "(PRODUCT)RED"]),
    ("Apple Watch Ultra", 2022, [("49mm", 799)], None, ["Natural Titanium"]),
    ("Apple Watch Series 9", 2023, [("41mm", 399), ("45mm", 429)], 100, ["Midnight", "Starlight", "Silver", "Pink", "(PRODUCT)RED"]),
    ("Apple Watch Ultra 2", 2023, [("49mm", 799)], None, ["Natural Titanium", "Black Titanium"]),
    ("Apple Watch Series 10", 2024, [("42mm", 399), ("46mm", 429)], 100, ["Jet Black", "Rose Gold", "Silver"]),
    ("Apple Watch SE 3", 2025, [("40mm", 249), ("44mm", 279)], 50, ["Midnight", "Starlight"]),
    ("Apple Watch Series 11", 2025, [("42mm", 399), ("46mm", 429)], 100, ["Jet Black", "Space Gray", "Silver", "Rose Gold"]),
    ("Apple Watch Ultra 3", 2025, [("49mm", 799)], None, ["Natural Titanium", "Black Titanium"]),
]
def watch_combos(sizes, cell, cols):
    out = []
    for s, pr in sizes:
        conns = [("GPS + Cellular", 0)] if cell is None else [("GPS", 0), ("GPS + Cellular", cell)]
        for conn, add in conns:
            for c in cols:
                out.append((f"{s} {conn}", c, pr + add))
    return out
write("apple-watches-shopify-import.csv", [dict(
    name=n, vendor="Apple", type="Smartwatch", year=y, brand=.9, grades=GRADES, grams=150,
    tags="condition:refurbished, Apple Watch, Apple, Smartwatches", body=W_BODY.format(n=n),
    opt2="Size", opt3="Color", combos=watch_combos(sz, cell, cols)) for n, y, sz, cell, cols in watches])
