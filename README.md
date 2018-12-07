# EMnify SIM Mover (Helper Script)
This script is here to show how you can build custom logic on top of our comprehensive and easy to use APIs to manage your SIM cards in an automated manner.

It will help you shift a batch of SIM cards from one organisation to another one in case you need to.

It is build in the programming language Node.js (Java Script) which is an easy language most developers can develop and that runs on all platforms.

The execution of the API requests is being throttled to 2 requests per second in order to not get blocked due to overloading the API.

The account you use for executin needs to have the "support" role assigned, otherwise the script can't detatch the SIMs from the endpoints of the organisation they are moved away from.

![Sample image of script usage](/console_output.png)

## Installation

### On Ubuntu or Debian
Open the terminal and type the following
```
sudo apt install git nodejs
git clone git://github.com/EMnify/simMover.git ~/simMover
cd ~/simMover
npm install
sudo npm link
```
> This should download this script, install all dependent modules and install the script so you can use it everywhere. 

## Usage
The script can be executed anywhere in the terminal now by typing `simMover` and hitting enter.

It will ask you to select and enter all the relevant information.

What you should prepare in order to use it:
* A CSV file without a header containing a list of all the ICCIDs, IMSIs or SIM IDs you want to move
* An application token of the organisation that will move the sim card (not an enterprise organisation)
* An application token of the enterprise organisation where the sims are currently residing (in order to detatch them from endpoints there)
* The ID of the organisation you want to move the sim cards to
