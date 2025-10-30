Results Directory
=================

Analysis results will be saved here.

After running the analyzer, you'll see:

results/
  └── <repository-name>/
      ├── analyzer.log                 (Execution log)
      ├── combined_results.json       (All results combined)
      ├── repository_history.json     (Git history analysis)
      ├── commit_classification.json  (Commit classification)
      ├── tech_stack.json             (Tech stack analysis)
      ├── code_quality.json           (Code quality metrics)
      ├── vulnerabilities.json        (Security scan results)
      └── extractions/
          ├── repository_history.log  (Raw git log)
          ├── commit_analysis.log     (Commit messages)
          └── ext_cm.log              (CodeMaat format)

Each repository gets its own subdirectory with timestamped results.

You can specify a custom output directory with:
  analyzer.exe --repo C:\path\to\repo --output C:\custom\output

