# EMnify SIM Mover (Helper Script)
This script is here to show how you can build custom logic on top of our comprehensive and easy to use APIs to manage your SIM cards in an automated manner.

It will help you shift a batch of SIM cards from one organisation to another one in case you need to.

It is build in the programming language Node.js (Java Script) which is an easy language most developers and even frontend developers can develop and that runs on all platforms.

The execution of the API requests is being throttled to 2 requests per second in order to not get blocked due to overloading the API.

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