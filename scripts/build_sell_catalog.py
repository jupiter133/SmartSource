"""Builds scripts/sell-catalog.json: every buyback device with ESTIMATED buyback prices (CAD).

Run: python3 scripts/build_sell_catalog.py
Then load it into Shopify: node scripts/setup-sell-metaobjects.mjs

Prices are rough estimates, not market data. Formula:
  resale value (CAD) = launch price of that option (USD) x age factor x brand factor x USD->CAD
  buyback = resale x condition share, rounded to $5
Edit SHARE / FACTOR / BRAND below or the model lists, then re-run.
"""
import json, os

YEAR = 2026
FACTOR = {0: .85, 1: .72, 2: .60, 3: .50, 4: .42, 5: .36, 6: .31, 7: .27, 8: .24, 9: .22, 10: .20}
SHARE = {"like_new": .62, "good": .52, "fair": .40, "cracked": .24, "defective": .08}  # of resale value
BRAND = {"Apple": .9, "Samsung": .75, "Sony": 2.0, "Microsoft": 1.7, "Nintendo": 1.9, "Valve": 1.4}  # consoles hold value
USD_TO_CAD = 1.35
CATEGORIES = ["Smartphone", "Tablet", "Smartwatch", "Laptop/MacBook", "Gaming Console", "Audio"]


def handle(s):
    h = "".join(c if c.isalnum() else "-" for c in s.lower().replace("+", " plus"))
    while "--" in h:
        h = h.replace("--", "-")
    return h.strip("-")


def r5(x):
    return max(5, int(round(x / 5.0)) * 5)


devices = []


def add(name, category, brand, year, storages, popular=False):
    """storages: [(label, launch_price_for_that_option)]"""
    age = FACTOR[min(YEAR - year, 10)] * BRAND[brand] * USD_TO_CAD
    prices = []
    for label, launch in storages:
        resale = launch * age
        prices.append({"storage": label, **{k: r5(resale * v) for k, v in SHARE.items()}})
    devices.append({"handle": handle(name), "name": name, "category": category, "brand": brand,
                    "release_year": year, "is_popular": popular, "prices": prices})


def st(*pairs):
    return list(pairs)


# ---------------------------------------------------------------- iPhone (8 and newer)
P = "Smartphone"
for name, year, opts, pop in [
    ("iPhone 8", 2017, st(("64GB", 699), ("128GB", 749), ("256GB", 849)), False),
    ("iPhone 8 Plus", 2017, st(("64GB", 799), ("128GB", 849), ("256GB", 949)), False),
    ("iPhone X", 2017, st(("64GB", 999), ("256GB", 1149)), False),
    ("iPhone XR", 2018, st(("64GB", 749), ("128GB", 799), ("256GB", 899)), False),
    ("iPhone XS", 2018, st(("64GB", 999), ("256GB", 1149), ("512GB", 1349)), False),
    ("iPhone XS Max", 2018, st(("64GB", 1099), ("256GB", 1249), ("512GB", 1449)), False),
    ("iPhone 11", 2019, st(("64GB", 699), ("128GB", 749), ("256GB", 849)), False),
    ("iPhone 11 Pro", 2019, st(("64GB", 999), ("256GB", 1149), ("512GB", 1349)), False),
    ("iPhone 11 Pro Max", 2019, st(("64GB", 1099), ("256GB", 1249), ("512GB", 1449)), False),
    ("iPhone SE (2nd gen)", 2020, st(("64GB", 399), ("128GB", 449), ("256GB", 549)), False),
    ("iPhone 12 mini", 2020, st(("64GB", 699), ("128GB", 749), ("256GB", 849)), False),
    ("iPhone 12", 2020, st(("64GB", 799), ("128GB", 849), ("256GB", 949)), False),
    ("iPhone 12 Pro", 2020, st(("128GB", 999), ("256GB", 1099), ("512GB", 1299)), False),
    ("iPhone 12 Pro Max", 2020, st(("128GB", 1099), ("256GB", 1199), ("512GB", 1399)), False),
    ("iPhone 13 mini", 2021, st(("128GB", 699), ("256GB", 799), ("512GB", 999)), False),
    ("iPhone 13", 2021, st(("128GB", 799), ("256GB", 899), ("512GB", 1099)), True),
    ("iPhone 13 Pro", 2021, st(("128GB", 999), ("256GB", 1099), ("512GB", 1299), ("1TB", 1499)), False),
    ("iPhone 13 Pro Max", 2021, st(("128GB", 1099), ("256GB", 1199), ("512GB", 1399), ("1TB", 1599)), False),
    ("iPhone SE (3rd gen)", 2022, st(("64GB", 429), ("128GB", 479), ("256GB", 579)), False),
    ("iPhone 14", 2022, st(("128GB", 799), ("256GB", 899), ("512GB", 1099)), False),
    ("iPhone 14 Plus", 2022, st(("128GB", 899), ("256GB", 999), ("512GB", 1199)), False),
    ("iPhone 14 Pro", 2022, st(("128GB", 999), ("256GB", 1099), ("512GB", 1299), ("1TB", 1499)), False),
    ("iPhone 14 Pro Max", 2022, st(("128GB", 1099), ("256GB", 1199), ("512GB", 1399), ("1TB", 1599)), False),
    ("iPhone 15", 2023, st(("128GB", 799), ("256GB", 899), ("512GB", 1099)), False),
    ("iPhone 15 Plus", 2023, st(("128GB", 899), ("256GB", 999), ("512GB", 1199)), False),
    ("iPhone 15 Pro", 2023, st(("128GB", 999), ("256GB", 1099), ("512GB", 1299), ("1TB", 1499)), False),
    ("iPhone 15 Pro Max", 2023, st(("256GB", 1199), ("512GB", 1399), ("1TB", 1599)), True),
    ("iPhone 16e", 2025, st(("128GB", 599), ("256GB", 699), ("512GB", 899)), False),
    ("iPhone 16", 2024, st(("128GB", 799), ("256GB", 899), ("512GB", 1099)), False),
    ("iPhone 16 Plus", 2024, st(("128GB", 899), ("256GB", 999), ("512GB", 1199)), False),
    ("iPhone 16 Pro", 2024, st(("128GB", 999), ("256GB", 1099), ("512GB", 1299), ("1TB", 1499)), False),
    ("iPhone 16 Pro Max", 2024, st(("256GB", 1199), ("512GB", 1399), ("1TB", 1599)), True),
    ("iPhone 17", 2025, st(("256GB", 799), ("512GB", 999)), True),
    ("iPhone Air", 2025, st(("256GB", 999), ("512GB", 1199), ("1TB", 1399)), False),
    ("iPhone 17 Pro", 2025, st(("256GB", 1099), ("512GB", 1299), ("1TB", 1499)), True),
    ("iPhone 17 Pro Max", 2025, st(("256GB", 1199), ("512GB", 1399), ("1TB", 1599), ("2TB", 1999)), True),
]:
    add(name, P, "Apple", year, opts, pop)

# ---------------------------------------------------------------- Samsung phones
for name, year, opts, pop in [
    ("Galaxy S21", 2021, st(("128GB", 799), ("256GB", 849)), False),
    ("Galaxy S21+", 2021, st(("128GB", 999), ("256GB", 1049)), False),
    ("Galaxy S21 Ultra", 2021, st(("128GB", 1199), ("256GB", 1249), ("512GB", 1379)), False),
    ("Galaxy S21 FE", 2022, st(("128GB", 699), ("256GB", 769)), False),
    ("Galaxy S22", 2022, st(("128GB", 799), ("256GB", 849)), False),
    ("Galaxy S22+", 2022, st(("128GB", 999), ("256GB", 1049)), False),
    ("Galaxy S22 Ultra", 2022, st(("128GB", 1199), ("256GB", 1299), ("512GB", 1399), ("1TB", 1599)), False),
    ("Galaxy S23", 2023, st(("128GB", 799), ("256GB", 859)), False),
    ("Galaxy S23+", 2023, st(("256GB", 999), ("512GB", 1119)), False),
    ("Galaxy S23 Ultra", 2023, st(("256GB", 1199), ("512GB", 1379), ("1TB", 1619)), False),
    ("Galaxy S23 FE", 2023, st(("128GB", 599), ("256GB", 659)), False),
    ("Galaxy S24", 2024, st(("128GB", 799), ("256GB", 859)), False),
    ("Galaxy S24+", 2024, st(("256GB", 999), ("512GB", 1119)), False),
    ("Galaxy S24 Ultra", 2024, st(("256GB", 1299), ("512GB", 1419), ("1TB", 1659)), True),
    ("Galaxy S24 FE", 2024, st(("128GB", 649), ("256GB", 709)), False),
    ("Galaxy S25", 2025, st(("128GB", 799), ("256GB", 859)), False),
    ("Galaxy S25+", 2025, st(("256GB", 999), ("512GB", 1119)), False),
    ("Galaxy S25 Ultra", 2025, st(("256GB", 1299), ("512GB", 1419), ("1TB", 1659)), True),
    ("Galaxy S25 Edge", 2025, st(("256GB", 1099), ("512GB", 1219)), False),
    ("Galaxy S25 FE", 2025, st(("128GB", 649), ("256GB", 709)), False),
    ("Galaxy Z Flip5", 2023, st(("256GB", 999), ("512GB", 1119)), False),
    ("Galaxy Z Fold5", 2023, st(("256GB", 1799), ("512GB", 1919), ("1TB", 2159)), False),
    ("Galaxy Z Flip6", 2024, st(("256GB", 1099), ("512GB", 1219)), False),
    ("Galaxy Z Fold6", 2024, st(("256GB", 1899), ("512GB", 2019), ("1TB", 2259)), False),
    ("Galaxy Z Flip7", 2025, st(("256GB", 1099), ("512GB", 1219)), False),
    ("Galaxy Z Fold7", 2025, st(("256GB", 1999), ("512GB", 2119), ("1TB", 2419)), False),
    ("Galaxy A15 5G", 2024, st(("128GB", 199),), False),
    ("Galaxy A16 5G", 2024, st(("128GB", 199),), False),
    ("Galaxy A35 5G", 2024, st(("128GB", 399),), False),
    ("Galaxy A36 5G", 2025, st(("128GB", 399), ("256GB", 459)), False),
    ("Galaxy A54 5G", 2023, st(("128GB", 449),), False),
]:
    add(f"Samsung {name}", P, "Samsung", year, opts, pop)

# ---------------------------------------------------------------- iPads (storage + connectivity)
def ipad_opts(storages, cell):
    return [(f"{s} Wi-Fi", p) for s, p in storages] + [(f"{s} Wi-Fi + Cellular", p + cell) for s, p in storages]

for name, year, opts, cell, pop in [
    ("iPad (9th gen)", 2021, st(("64GB", 329), ("256GB", 479)), 130, False),
    ("iPad (10th gen)", 2022, st(("64GB", 449), ("256GB", 599)), 150, False),
    ("iPad (A16)", 2025, st(("128GB", 349), ("256GB", 449), ("512GB", 649)), 150, True),
    ("iPad mini (6th gen)", 2021, st(("64GB", 499), ("256GB", 649)), 150, False),
    ("iPad mini (A17 Pro)", 2024, st(("128GB", 499), ("256GB", 599), ("512GB", 799)), 150, True),
    ("iPad Air (5th gen, M1)", 2022, st(("64GB", 599), ("256GB", 749)), 150, False),
    ("iPad Air 11-inch (M2)", 2024, st(("128GB", 599), ("256GB", 699), ("512GB", 899), ("1TB", 1099)), 150, False),
    ("iPad Air 13-inch (M2)", 2024, st(("128GB", 799), ("256GB", 899), ("512GB", 1099), ("1TB", 1299)), 150, False),
    ("iPad Air 11-inch (M3)", 2025, st(("128GB", 599), ("256GB", 699), ("512GB", 899), ("1TB", 1099)), 150, True),
    ("iPad Air 13-inch (M3)", 2025, st(("128GB", 799), ("256GB", 899), ("512GB", 1099), ("1TB", 1299)), 150, True),
    ("iPad Pro 11-inch (4th gen, M2)", 2022, st(("128GB", 799), ("256GB", 899), ("512GB", 1099), ("1TB", 1499), ("2TB", 1899)), 200, False),
    ("iPad Pro 12.9-inch (6th gen, M2)", 2022, st(("128GB", 1099), ("256GB", 1199), ("512GB", 1399), ("1TB", 1799), ("2TB", 2199)), 200, False),
    ("iPad Pro 11-inch (M4)", 2024, st(("256GB", 999), ("512GB", 1199), ("1TB", 1599), ("2TB", 1999)), 200, True),
    ("iPad Pro 13-inch (M4)", 2024, st(("256GB", 1299), ("512GB", 1499), ("1TB", 1899), ("2TB", 2299)), 200, True),
]:
    add(name, "Tablet", "Apple", year, ipad_opts(opts, cell), pop)

# ---------------------------------------------------------------- Samsung tablets (Wi-Fi)
for name, year, opts, pop in [
    ("Galaxy Tab S8", 2022, st(("128GB", 699), ("256GB", 779)), False),
    ("Galaxy Tab S8+", 2022, st(("128GB", 899), ("256GB", 979)), False),
    ("Galaxy Tab S8 Ultra", 2022, st(("128GB", 1099), ("256GB", 1199), ("512GB", 1399)), False),
    ("Galaxy Tab S9", 2023, st(("128GB", 799), ("256GB", 919)), False),
    ("Galaxy Tab S9+", 2023, st(("256GB", 999), ("512GB", 1119)), False),
    ("Galaxy Tab S9 Ultra", 2023, st(("256GB", 1199), ("512GB", 1319), ("1TB", 1619)), False),
    ("Galaxy Tab S9 FE", 2023, st(("128GB", 449), ("256GB", 519)), False),
    ("Galaxy Tab S9 FE+", 2023, st(("128GB", 599), ("256GB", 699)), False),
    ("Galaxy Tab S10+", 2024, st(("256GB", 999), ("512GB", 1119)), False),
    ("Galaxy Tab S10 Ultra", 2024, st(("256GB", 1199), ("512GB", 1319), ("1TB", 1619)), True),
    ("Galaxy Tab S10 FE", 2025, st(("128GB", 499), ("256GB", 579)), False),
    ("Galaxy Tab S10 FE+", 2025, st(("128GB", 649), ("256GB", 749)), False),
    ("Galaxy Tab A9+", 2023, st(("64GB", 219), ("128GB", 269)), False),
]:
    add(f"Samsung {name}", "Tablet", "Samsung", year, [(f"{s} Wi-Fi", p) for s, p in opts], pop)

# ---------------------------------------------------------------- MacBooks
for name, year, opts, pop in [
    ("MacBook Air 13-inch (M1)", 2020, st(("256GB", 999), ("512GB", 1249)), False),
    ("MacBook Air 13-inch (M2)", 2022, st(("256GB", 1199), ("512GB", 1499)), False),
    ("MacBook Air 15-inch (M2)", 2023, st(("256GB", 1299), ("512GB", 1499)), False),
    ("MacBook Air 13-inch (M3)", 2024, st(("256GB", 1099), ("512GB", 1299)), True),
    ("MacBook Air 15-inch (M3)", 2024, st(("256GB", 1299), ("512GB", 1499)), False),
    ("MacBook Air 13-inch (M4)", 2025, st(("256GB", 999), ("512GB", 1199)), True),
    ("MacBook Air 15-inch (M4)", 2025, st(("256GB", 1199), ("512GB", 1399)), True),
    ("MacBook Pro 14-inch (M3)", 2023, st(("512GB", 1599), ("1TB", 1799)), False),
    ("MacBook Pro 14-inch (M3 Pro)", 2023, st(("512GB", 1999), ("1TB", 2399)), False),
    ("MacBook Pro 16-inch (M3 Pro)", 2023, st(("512GB", 2499),), False),
    ("MacBook Pro 14-inch (M4)", 2024, st(("512GB", 1599), ("1TB", 1799)), True),
    ("MacBook Pro 14-inch (M4 Pro)", 2024, st(("512GB", 1999),), True),
    ("MacBook Pro 16-inch (M4 Pro)", 2024, st(("512GB", 2499),), True),
]:
    add(name, "Laptop/MacBook", "Apple", year, opts, pop)

# ---------------------------------------------------------------- Apple Watch (size + connectivity)
def watch_opts(sizes, cell):
    if cell is None:
        return [(f"{s} GPS + Cellular", p) for s, p in sizes]
    return [(f"{s} GPS", p) for s, p in sizes] + [(f"{s} GPS + Cellular", p + cell) for s, p in sizes]

for name, year, sizes, cell, pop in [
    ("Apple Watch Series 7", 2021, st(("41mm", 399), ("45mm", 429)), 100, False),
    ("Apple Watch SE (2nd gen)", 2022, st(("40mm", 249), ("44mm", 279)), 50, False),
    ("Apple Watch Series 8", 2022, st(("41mm", 399), ("45mm", 429)), 100, False),
    ("Apple Watch Ultra", 2022, st(("49mm", 799),), None, False),
    ("Apple Watch Series 9", 2023, st(("41mm", 399), ("45mm", 429)), 100, False),
    ("Apple Watch Ultra 2", 2023, st(("49mm", 799),), None, True),
    ("Apple Watch Series 10", 2024, st(("42mm", 399), ("46mm", 429)), 100, True),
    ("Apple Watch SE 3", 2025, st(("40mm", 249), ("44mm", 279)), 50, False),
    ("Apple Watch Series 11", 2025, st(("42mm", 399), ("46mm", 429)), 100, True),
    ("Apple Watch Ultra 3", 2025, st(("49mm", 799),), None, True),
]:
    add(name, "Smartwatch", "Apple", year, watch_opts(sizes, cell), pop)

# ---------------------------------------------------------------- Audio
for name, year, price, pop in [
    ("AirPods (2nd gen)", 2019, 129, False), ("AirPods (3rd gen)", 2021, 169, False),
    ("AirPods 4", 2024, 129, False), ("AirPods Pro", 2019, 249, False),
    ("AirPods Pro 2", 2022, 249, True), ("AirPods Max", 2020, 549, True),
]:
    add(name, "Audio", "Apple", year, [("Standard", price)], pop)

# ---------------------------------------------------------------- Consoles (edition as the "storage" option)
for name, brand, year, opts, pop in [
    ("PlayStation 4 Slim", "Sony", 2016, st(("500GB", 299), ("1TB", 349)), False),
    ("PlayStation 4 Pro", "Sony", 2016, st(("1TB", 399),), False),
    ("PlayStation 5", "Sony", 2020, st(("Digital Edition 825GB", 399), ("Disc Edition 825GB", 499)), True),
    ("PlayStation 5 Slim", "Sony", 2023, st(("Digital Edition 1TB", 449), ("Disc Edition 1TB", 499)), True),
    ("PlayStation 5 Pro", "Sony", 2024, st(("2TB", 699),), True),
    ("Xbox Series S", "Microsoft", 2020, st(("512GB", 299), ("1TB", 349)), False),
    ("Xbox Series X", "Microsoft", 2020, st(("1TB Digital", 449), ("1TB", 499), ("2TB", 599)), True),
    ("Nintendo Switch", "Nintendo", 2019, st(("32GB", 299),), False),
    ("Nintendo Switch OLED", "Nintendo", 2021, st(("64GB", 349),), True),
    ("Nintendo Switch Lite", "Nintendo", 2019, st(("32GB", 199),), False),
    ("Nintendo Switch 2", "Nintendo", 2025, st(("256GB", 449),), True),
    ("Steam Deck OLED", "Valve", 2023, st(("512GB", 549), ("1TB", 649)), True),
]:
    add(name, "Gaming Console", brand, year, opts, pop)

# sort order inside each category: newest first, then by launch price (proxy for flagship)
for cat in CATEGORIES:
    group = [d for d in devices if d["category"] == cat]
    group.sort(key=lambda d: (-d["release_year"], -max(p["like_new"] for p in d["prices"])))
    for i, d in enumerate(group, 1):
        d["sort_order"] = i

handles = [d["handle"] for d in devices]
assert len(handles) == len(set(handles)), "duplicate device handles"
brands = sorted({d["brand"] for d in devices}, key=lambda b: ["Apple", "Samsung", "Sony", "Microsoft", "Nintendo", "Valve"].index(b))
out = {
    "note": "ESTIMATED buyback prices in CAD. Review before launch.",
    "categories": [{"handle": handle(c), "name": c, "sort_order": i} for i, c in enumerate(CATEGORIES, 1)],
    "brands": [{"handle": handle(b), "name": b, "sort_order": i} for i, b in enumerate(brands, 1)],
    "devices": devices,
}
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sell-catalog.json")
json.dump(out, open(path, "w"), indent=1)
n_prices = sum(len(d["prices"]) for d in devices)
print(f"{len(devices)} devices, {n_prices} price rows, {sum(d['is_popular'] for d in devices)} popular -> {path}")
for cat in CATEGORIES:
    print(f"  {cat}: {sum(d['category'] == cat for d in devices)}")
