#!/usr/bin/env python3
"""
Markdown Brain Index Updater
Automatically updates INDEX.md when new documents are added
"""

import os
import json
from datetime import datetime
from pathlib import Path
import re

# Configuration
DOCS_DIR = "/home/helye/Development/Projects/Work/Nextjs/moshimoshi/docs"
INDEX_FILE = "INDEX.md"
QUICK_REF_FILE = "QUICK_REFERENCE.md"

# Categories mapping
CATEGORY_PATTERNS = {
    "Authentication System": ["auth", "login", "signin", "signup", "session"],
    "Admin & Management": ["admin", "dashboard", "management"],
    "Development & UI": ["ui", "component", "theme", "development", "log"],
    "API Documentation": ["api", "endpoint", "route"],
    "Security": ["security", "permission", "rate", "audit"],
    "Configuration": ["config", "setup", "env", "settings"],
    "Notes & Memos": ["memo", "note", "todo", "reminder"]
}

def extract_metadata(file_path):
    """Extract metadata from markdown file"""
    metadata = {
        "title": Path(file_path).stem.replace("_", " ").replace("-", " ").title(),
        "category": "Uncategorized",
        "tags": [],
        "summary": "",
        "headers": []
    }
    
    try:
        with open(file_path, 'r') as f:
            content = f.read()
            lines = content.split('\n')
            
            # Extract title from first heading
            for line in lines[:10]:
                if line.startswith('# '):
                    metadata["title"] = line[2:].strip()
                    break
            
            # Extract headers
            for line in lines:
                if line.startswith('#'):
                    level = len(line.split()[0])
                    if level <= 3:
                        metadata["headers"].append({
                            "level": level,
                            "text": line.lstrip('#').strip()
                        })
            
            # Determine category based on content
            content_lower = content.lower()
            for category, patterns in CATEGORY_PATTERNS.items():
                if any(pattern in content_lower for pattern in patterns):
                    metadata["category"] = category
                    break
            
            # Extract potential tags
            tag_patterns = ["authentication", "ui", "api", "security", "admin", "development", "configuration"]
            for tag in tag_patterns:
                if tag in content_lower:
                    metadata["tags"].append(f"#{tag}")
            
            # Get first paragraph as summary
            paragraphs = [p.strip() for p in content.split('\n\n') if p.strip() and not p.strip().startswith('#')]
            if paragraphs:
                metadata["summary"] = paragraphs[0][:200] + "..." if len(paragraphs[0]) > 200 else paragraphs[0]
                
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
    
    return metadata

def scan_documents():
    """Scan directory for markdown documents"""
    documents = []
    
    for root, dirs, files in os.walk(DOCS_DIR):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        
        for file in files:
            if file.endswith('.md') and file not in [INDEX_FILE, QUICK_REF_FILE]:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, DOCS_DIR)
                
                # Get file stats
                stats = os.stat(file_path)
                
                doc_info = {
                    "path": rel_path,
                    "full_path": file_path,
                    "name": file,
                    "modified": datetime.fromtimestamp(stats.st_mtime),
                    "size": stats.st_size
                }
                
                # Extract metadata
                doc_info.update(extract_metadata(file_path))
                documents.append(doc_info)
    
    return documents

def generate_index(documents):
    """Generate INDEX.md content"""
    
    # Sort by modification date
    docs_by_date = sorted(documents, key=lambda x: x["modified"], reverse=True)
    
    # Group by category
    docs_by_category = {}
    for doc in documents:
        category = doc["category"]
        if category not in docs_by_category:
            docs_by_category[category] = []
        docs_by_category[category].append(doc)
    
    # Build index content
    content = f"""# 📚 Markdown Brain Index

> Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
> Total Documents: {len(documents)}

## 🎯 Quick Access
"""
    
    # Add top 5 recent documents
    for doc in docs_by_date[:5]:
        content += f"- [{doc['title']}]({doc['path']}) - {doc['modified'].strftime('%Y-%m-%d')}\n"
    
    content += "\n## 📁 By Category\n\n"
    
    # Add categorized documents
    for category in sorted(docs_by_category.keys()):
        docs = docs_by_category[category]
        content += f"### {category}\n"
        for doc in sorted(docs, key=lambda x: x["name"]):
            summary = f" - {doc['summary'][:60]}..." if doc['summary'] else ""
            content += f"- [{doc['title']}]({doc['path']}){summary}\n"
        content += "\n"
    
    # Add statistics
    content += f"""## 📊 Statistics

- **Total Documents**: {len(documents)}
- **Categories**: {len(docs_by_category)}
- **Last Update**: {docs_by_date[0]['modified'].strftime('%Y-%m-%d %H:%M') if docs_by_date else 'N/A'}
- **Largest Document**: {max(documents, key=lambda x: x['size'])['name'] if documents else 'N/A'}

## 🏷️ All Tags
"""
    
    # Collect all tags
    all_tags = set()
    for doc in documents:
        all_tags.update(doc["tags"])
    
    if all_tags:
        content += " ".join(sorted(all_tags)) + "\n"
    
    content += """
---
*Auto-generated by update-index.py*
"""
    
    return content

def update_metadata_json(documents):
    """Save metadata to JSON for other tools"""
    metadata = {
        "last_updated": datetime.now().isoformat(),
        "document_count": len(documents),
        "documents": [
            {
                "path": doc["path"],
                "title": doc["title"],
                "category": doc["category"],
                "tags": doc["tags"],
                "modified": doc["modified"].isoformat(),
                "size": doc["size"]
            }
            for doc in documents
        ]
    }
    
    json_path = os.path.join(DOCS_DIR, "metadata.json")
    with open(json_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"✅ Metadata saved to {json_path}")

def main():
    print("🔍 Scanning markdown documents...")
    documents = scan_documents()
    print(f"📄 Found {len(documents)} documents")
    
    print("📝 Generating index...")
    index_content = generate_index(documents)
    
    index_path = os.path.join(DOCS_DIR, INDEX_FILE)
    with open(index_path, 'w') as f:
        f.write(index_content)
    
    print(f"✅ Index updated: {index_path}")
    
    print("💾 Saving metadata...")
    update_metadata_json(documents)
    
    print("✨ Update complete!")

if __name__ == "__main__":
    main()