# EMnify SIM Mover (Helper Script)
This script is here to show how you can build custom logic on top of our comprehensive and easy to use APIs to manage your SIM cards in an automated manner.

It will help you shift a batch of SIM cards from one organisation to another one in case you need to.

It is build in the programming language Node.js (Java Script) which is an easy language most developers can develop and that runs on all platforms.

The execution of the API requests is being throttled to 2 requests per second in order to not get blocked due to overloading the API.

The account you use for executin needs to have the "support" role assigned, otherwise the script can't detatch the SIMs from the endpoints of the organisation they are moved away from.

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
git clone git://github.com/EMnify/simMover.git
cd simMover
npm install
node index.js --help
```
> This should download this script, install all dependent modules and print the help that should explain you how to use the script.
> 
### Things that could go wrong
1. You are on another or older operating system
    1. Error: `npm: command not found` => Solution: `sudo apt install npm`

## Usage
> The script can take a file as input like the sample file with comma seperated IMSIS like so:
```
node index.js --simIdentifierType iccid --csvFile sample.csv --destinationOrgId 4192 --setStatus suspended --dryRun --appToken tokenOfYourAccount --enterpriseAppToken appTokenOfTheEnterpriseWithTheSimsCurrentlyAssigned
```
> Or you give the imsis directly as parameters like so:
```
node index.js --simIdentifierType iccid --list 123,2345 --destinationOrgId 4192 --setStatus suspended --dryRun --appToken tokenOfYourAccount --enterpriseAppToken appTokenOfTheEnterpriseWithTheSimsCurrentlyAssigned
```

### Parameters
| Shorthand | Parameter | Description  | Required | Sample |
|-|-|-|-|-|
| -V | --version            | output the version number                                                       | false |       |
| -t | --simIdentifierType  | Define whether you want to identiy your SIM by simid, imsi or iccid             | true  | iccid |
| -l | --list               | List of simIdentifiers to be moved like 123,234'                                |       |       |
| -c | --imsiCsvFile        | Path to a file that contains a comma seperated list of simIdentifiers - NO headline |       | sample.csv |
| -o | --destinationOrgId   | Destination organisation ID to move them to                                     | true  | 1234  |
| -s | --setStatus          | Set the status of moved SIM cards [activated, suspended, issued or deleted]     | true  | suspended  |
| -d | --dryRun             | Outputs planned changes without executing them live                             | false |       |
| -t | --appToken           | Application token of the account you act from  (MNO, Reseller, Service Provider)| true  | token |
| -e | --enterpriseAppToken | Application token of the enterprise account you want to move the SIMs away from | true  | token |
| -h | --help               | Outputs usage information                                                       | false |       |