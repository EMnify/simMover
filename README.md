# SIM Mover - Helper Script

## Installation
### On Windows 
> Go to https://gitforwindows.org/, download and install "git"
> 
> Go to https://nodejs.org/en/download/, download and install nodejs
>
> Open git bash (from your Windows menu)

### On Ubuntu
> Open the terminal and type the following
```
sudo apt install git nodejs
```

## Getting it to run

In the same terminal that you just opened (git bash or terminal at Ubuntu), execute the follwing:
```
cd ~/Desktop
git clone git@github.com:EMnify/simMover.git
cd simMover
npm install
node index.js --help
```
This should doenload this script, install all dependent modules and print the help that should explain you how to use the script.

## Usage
The script can take a file as input like the sample file with comma seperated IMSIS or it can take the imsis directly in the command line input
```
node index.js -f sampleImsis.csv -o 4192 -d -t yourApplicationToken

node index.js --imsiList -o 4192 -d -t yourApplicationToken
```