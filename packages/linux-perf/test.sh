#!/bin/bash

echo "Testing with no extra flags"
tap "test/*.js"

# Variant: --interpreted-frames-native-stack
echo "Testing with --interpreted-frames-native-stack"
tap --node-arg=--interpreted-frames-native-stack "test/*.js"
