# generate_post_content.py (auto-generate for ALL communities by default)

import argparse
import json
import os
import random
import re
import sys
from pathlib import Path

import pandas as pd
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "Daily_Post_Content_Dataset.csv"
DEFAULT_MODEL_DIR = BASE_DIR / "outputs"


# -------------------------------------------------------
# CLI ARGUMENTS
# -------------------------------------------------------
parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true",
                    help="Only generate and print content — do NOT save to CSV")
parser.add_argument("--community", type=str, default=None,
                    help="Generate only for this community")
parser.add_argument("--all", "--all-communities", dest="all_communities",
                    action="store_true",
                    help="Generate for ALL communities in the CSV")
parser.add_argument("--num-per-community", type=int, default=1,
                    help="How many posts to generate per community")
parser.add_argument("--timeslot", type=str,
                    choices=["morning", "evening", "night"],
                    default=None,
                    help="Timeslot hint")
parser.add_argument("--csv-only", action="store_true",
                    help="Use CSV sampling instead of model")
parser.add_argument("--model-dir", type=str, default=str(DEFAULT_MODEL_DIR),
                    help="Folder containing trained model")
parser.add_argument("--temperature", type=float, default=0.8)
args = parser.parse_args()


# -------------------------------------------------------
# Default to ALL communities
# -------------------------------------------------------
if not args.community:
    args.all_communities = True


# -------------------------------------------------------
# Load CSV dataset
# -------------------------------------------------------
if not CSV_PATH.exists():
    print(f"ERROR: dataset file not found at {CSV_PATH}", file=sys.stderr)
    sys.exit(2)

df = pd.read_csv(str(CSV_PATH), encoding="utf-8")

# Ensure columns
for c in ["Community", "Tag", "Content", "Source"]:
    if c not in df.columns:
        df[c] = "" if c != "Source" else "generated"

df["Community"] = df["Community"].astype(str).str.strip()
df["Tag"] = df["Tag"].astype(str).str.strip()
df["Content"] = df["Content"].astype(str).str.strip()

# Clean invalid communities
df["Community"] = df["Community"].replace(["nan", "NaN", "None", "NONE", ""], pd.NA)
df = df.dropna(subset=["Community"]).reset_index(drop=True)

# Final community list
COMMUNITIES = sorted(df["Community"].unique().tolist())


# -------------------------------------------------------
# Device
# -------------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# -------------------------------------------------------
# LOAD MODEL
# -------------------------------------------------------
model = None
tokenizer = None

if not args.csv_only and Path(args.model_dir).exists():
    try:
        tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
        model = AutoModelForCausalLM.from_pretrained(args.model_dir)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        model.to(device)
        model.eval()
        print("Model loaded successfully", file=sys.stderr)
    except Exception as e:
        print(f"Model load failed: {e} — using CSV fallback.", file=sys.stderr)
        model = None
        tokenizer = None
else:
    print("CSV-only mode — model not used.", file=sys.stderr)


# -------------------------------------------------------
# Timeslot → Tag Groups (Option A: BEST mapping)
# -------------------------------------------------------
SLOT_TAG_HINT = {
    "morning": ["Diet", "Exercise"],
    "evening": ["SelfCare", "Motivation"],
    "night": ["Awareness", "MythVsFact", "Checkup"],
}

# Full weekly tag rotation list
WEEKLY_TAGS_ORDERED = [
    "Diet",       # Mon
    "Exercise",   # Tue
    "Awareness",  # Wed
    "MythVsFact", # Thu
    "Motivation", # Fri
    "Checkup",    # Sat
    "SelfCare",   # Sun
]


# -------------------------------------------------------
# Clean generated output
# -------------------------------------------------------
def clean_generated_text(raw_text: str, tag: str):
    text = (raw_text or "").strip()
    text = text.replace("—", "-").replace("–", "-")

    patterns = [
        r"^Community\s*:\s*.*\|\s*Tag\s*:\s*.*\|\s*Content\s*:",
        r"^Content\s*:\s*",
        r"^Post\s*[:\-]\s*",
    ]

    for pat in patterns:
        text = re.sub(pat, "", text, flags=re.IGNORECASE).strip()

    if not text:
        return f"No content generated for {tag}."

    last = max(text.rfind("."), text.rfind("!"), text.rfind("?"))
    if last >= 10:
        text = text[: last + 1]

    if not text.endswith((".", "!", "?")):
        text = text.rstrip(",:;") + "."

    return re.sub(r"\s+", " ", text).strip()


# -------------------------------------------------------
# Model text generation
# -------------------------------------------------------
def generate_with_model(tag: str, community: str, temperature=0.8):
    prompt = f"Community: {community} | Tag: {tag} | Content:"

    inputs = tokenizer(prompt, return_tensors="pt", truncation=True,
                       padding=True, max_length=80)

    output = model.generate(
        input_ids=inputs["input_ids"].to(device),
        attention_mask=inputs["attention_mask"].to(device),
        max_length=120,
        do_sample=True,
        temperature=temperature,
        top_p=0.9,
        top_k=50,
        repetition_penalty=1.1,
        no_repeat_ngram_size=3,
    )

    return tokenizer.decode(output[0], skip_special_tokens=True)


# -------------------------------------------------------
# Final content generator
# -------------------------------------------------------
def generate_content(tag, community, temperature=0.8):
    if model is not None:
        raw = generate_with_model(tag, community, temperature)
        return clean_generated_text(raw, tag)

    # CSV fallback
    subset = df[df["Community"].str.lower() == community.lower()]
    subset_tag = subset[subset["Tag"].str.lower() == tag.lower()]
    if len(subset_tag):
        return subset_tag.sample(1)["Content"].iloc[0]
    if len(subset):
        return subset.sample(1)["Content"].iloc[0]
    return f"Daily Post for {community}: stay active!"


# -------------------------------------------------------
# TAG Selection (Correct!)
# -------------------------------------------------------
import datetime
today_weekday = datetime.date.today().weekday()
rotation_start = today_weekday
rotation_counter = 0

def pick_tag_for_post():
    global rotation_counter

    if args.timeslot:
        choices = SLOT_TAG_HINT.get(args.timeslot)
        if choices:
            return random.choice(choices)
        return "General"

    # Rotate through 7 tags
    idx = (rotation_start + rotation_counter) % len(WEEKLY_TAGS_ORDERED)
    rotation_counter += 1
    return WEEKLY_TAGS_ORDERED[idx]


# -------------------------------------------------------
# Generate posts
# -------------------------------------------------------
results = []

def generate_for_community(comm, num=1):
    for _ in range(num):
        tag_used = pick_tag_for_post()
        content = generate_content(tag_used, comm, args.temperature)
        results.append({
            "community": comm,
            "tag": tag_used,
            "content": content,
            "title": f"{comm} Post",
        })


# Always generate for ALL communities
for comm in COMMUNITIES:
    generate_for_community(comm, args.num_per_community)


# -------------------------------------------------------
# Output results
# -------------------------------------------------------
print(json.dumps(results, ensure_ascii=False, indent=2))


# -------------------------------------------------------
# Save to CSV
# -------------------------------------------------------
if not args.dry_run:
    new_rows = [{
        "Community": r["community"],
        "Tag": r["tag"],
        "Content": r["content"],
        "Source": "generated"
    } for r in results]

    df = pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True)
    df.to_csv(str(CSV_PATH), index=False, encoding="utf-8")

    print(f"Saved {len(results)} posts to CSV", file=sys.stderr)
