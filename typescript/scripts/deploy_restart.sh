#! /bin/bash
bash $(dirname "$0")/deploy.sh
ha addons restart local_digital_alchemy
ha addons logs local_digital_alchemy