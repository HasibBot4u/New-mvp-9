import re

with open("backend/main.py", "r") as f:
    code = f.read()

# Add import logging at the top if not present
if "import logging" not in code:
    code = re.sub(
        r"import os\n",
        r"import os\nimport logging\n\nlogging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')\nlogger = logging.getLogger('nexusedu')\n\n",
        code,
        count=1
    )

def replacer(match):
    content = match.group(1)
    return f"logger.info({content})"

code = re.sub(r'print\((.*?),\s*flush=True\)', replacer, code)
code = re.sub(r'print\((.*?)\)', replacer, code)

with open("backend/main.py", "w") as f:
    f.write(code)

print("Done replacing print with logger.info")
