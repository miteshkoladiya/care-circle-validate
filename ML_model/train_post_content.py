# import argparse
# import pandas as pd
# from datasets import Dataset
# from transformers import AutoTokenizer, AutoModelForCausalLM, Trainer, TrainingArguments
# from pathlib import Path
# import sys

# # Resolve CSV path relative to this script file so the script works when run
# # from the repo root or other working directories.
# BASE_DIR = Path(__file__).resolve().parent
# CSV_PATH = BASE_DIR / "Daily_Post_Content_Dataset.csv"
# if not CSV_PATH.exists():
#     print(f"ERROR: dataset file not found at {CSV_PATH}")
#     print("Make sure the file 'Daily_Post_Content_Dataset.csv' is located in the ML_model/ folder.")
#     sys.exit(2)

# # Load dataset
# df = pd.read_csv(str(CSV_PATH), encoding="utf-8")

# # CLI: allow a --dry-run mode to prepare/tokenize dataset without running heavy training
# parser = argparse.ArgumentParser(description='Train post content generator')
# parser.add_argument('--dry-run', action='store_true', help='Prepare dataset and tokenize, but do not run training')
# args = parser.parse_args()

# # Make sure required columns exist
# required_cols = ["Community", "Tag", "Content"]
# for c in required_cols:
#     if c not in df.columns:
#         raise ValueError(f"Missing required column in CSV: {c}")

# # Drop rows with missing values in the required columns and reset index
# df = df.dropna(subset=required_cols).reset_index(drop=True)

# # Build the text field from three columns
# # Format example: "Community: Diabetes | Tag: Diet | Content: Start your day with..."
# df["text"] = df["Community"] + " | " + df["Tag"] + ": " + df["Content"]

# # Create a HuggingFace dataset with only the text column
# dataset = Dataset.from_pandas(df[["text"]], preserve_index=False)

# # Load tokenizer and model
# tokenizer = AutoTokenizer.from_pretrained("gpt2")
# # gpt2 has no pad token by default, set it to eos token
# tokenizer.pad_token = tokenizer.eos_token

# model = AutoModelForCausalLM.from_pretrained("gpt2")

# # Tokenize function
# def tokenize(batch):
#     enc = tokenizer(batch["text"], padding="max_length", truncation=True, max_length=256)
#     enc["labels"] = enc["input_ids"].copy()
#     return enc

# # Map tokenization over the dataset and remove the raw text column
# dataset = dataset.map(tokenize, batched=True, remove_columns=["text"])

# # Convert to torch format expected by Trainer
# dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "labels"])

# # Training arguments
# training_args = TrainingArguments(
#     output_dir="./outputs",
#     overwrite_output_dir=True,
#     num_train_epochs=1,
#     per_device_train_batch_size=2,
#     save_steps=200,
#     save_total_limit=2,
#     logging_dir="./logs",
#     logging_steps=50,
# )

# # Trainer
# trainer = Trainer(
#     model=model,
#     args=training_args,
#     train_dataset=dataset,
# )

# if args.dry_run:
#     print("Dry-run: dataset tokenized and ready. Skipping training as requested.")
# else:
#     # Train
#     try:
#         trainer.train()
#         # Save model and tokenizer
#         model.save_pretrained("./outputs")
#         tokenizer.save_pretrained("./outputs")
#         print("Model training complete. Saved in ./outputs")
#     except Exception as e:
#         print("Training failed:", e)
#         print("If this is due to missing dependencies (torch/accelerate), run: pip install transformers[torch] accelerate>=0.26.0")
#         raise

#!/usr/bin/env python3
# train_post_content.py
import argparse
import sys
from pathlib import Path

import pandas as pd
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, Trainer, TrainingArguments

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "Daily_Post_Content_Dataset.csv"

if not CSV_PATH.exists():
    print(f"ERROR: dataset file not found at {CSV_PATH}")
    print("Make sure the file 'Daily_Post_Content_Dataset.csv' is located in the same folder as this script.")
    sys.exit(2)

# CLI parser
parser = argparse.ArgumentParser(description="Train post content generator")
parser.add_argument("--dry-run", action="store_true", help="Prepare dataset and tokenize, but do not run training")
parser.add_argument("--model-name", type=str, default="gpt2", help="Base model name or path")
parser.add_argument("--output-dir", type=str, default="./outputs", help="Where to save trained model")
parser.add_argument("--max-length", type=int, default=256, help="Max token length for tokenization")
parser.add_argument("--epochs", type=int, default=1)
parser.add_argument("--batch-size", type=int, default=2)
args = parser.parse_args()

# Load dataset
df = pd.read_csv(str(CSV_PATH), encoding="utf-8")

# Ensure required columns exist and drop rows that are missing them
required_cols = ["Community", "Tag", "Content"]
for c in required_cols:
    if c not in df.columns:
        raise ValueError(f"Missing required column in CSV: {c}")

df = df.dropna(subset=required_cols).reset_index(drop=True)

# Optionally, trim whitespace and normalize Community names
df["Community"] = df["Community"].astype(str).str.strip()
df["Tag"] = df["Tag"].astype(str).str.strip()
df["Content"] = df["Content"].astype(str).str.strip()

# Build a textual field for training
# Example format: "Community: Diabetes | Tag: Diet | Content: Start your day..."
df["text"] = df["Community"] + " | " + df["Tag"] + ": " + df["Content"]

# Create HF dataset
dataset = Dataset.from_pandas(df[["text"]], preserve_index=False)

# Load tokenizer and model
tokenizer = AutoTokenizer.from_pretrained(args.model_name)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(args.model_name)

# Tokenization function
def tokenize(batch):
    enc = tokenizer(batch["text"], padding="max_length", truncation=True, max_length=args.max_length)
    enc["labels"] = enc["input_ids"].copy()
    return enc

print("Tokenizing dataset...")
dataset = dataset.map(tokenize, batched=True, remove_columns=["text"])

# Convert to torch format expected by Trainer
dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "labels"])

if args.dry_run:
    print("Dry-run: dataset tokenized and ready. Skipping training as requested.")
    # Optionally print some stats
    print(f"Number of training examples: {len(dataset)}")
    sys.exit(0)

# Training arguments
training_args = TrainingArguments(
    output_dir=args.output_dir,
    overwrite_output_dir=True,
    num_train_epochs=args.epochs,
    per_device_train_batch_size=args.batch_size,
    save_steps=200,
    save_total_limit=2,
    logging_dir="./logs",
    logging_steps=50,
    fp16=False,  # enable if you have a supported GPU and want faster training
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
)

# Train
try:
    trainer.train()
    model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    print(f"Model training complete. Saved in {args.output_dir}")
except Exception as e:
    print("Training failed:", e)
    print("If dependencies are missing, run: pip install transformers[torch] accelerate>=0.26.0")
    raise
