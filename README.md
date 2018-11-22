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

> In the same terminal that you just opened (git bash or terminal at Ubuntu), execute the follwing:
```
cd ~/Desktop
git clone git@github.com:EMnify/simMover.git
cd simMover
npm install
node index.js --help
```
> This should doenload this script, install all dependent modules and print the help that should explain you how to use the script.

## Usage
> The script can take a file as input like the sample file with comma seperated IMSIS like so:
```
node index.js --imsiCsvFile sampleImsis.csv --destinationOrgId 4192 --dryRun --appToken yourApplicationToken
```
> Or you give the imsis directly as parameters like so:
```
node index.js --imsiList 123456789123456,223456789123456 --destinationOrgId 4192 --dryRun --appToken yourApplicationToken
```
> Of course the destination organisation ID as well as an app token for authentication need to be provided.

>The --dryRun parameter is optional and will skipp the actual updating of the SIMs if set.