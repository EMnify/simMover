#!/usr/bin/env node
'use strict';

const program = require('commander');
const request = require('request');
const throttledRequest = require('throttled-request')(request);
const fs = require('fs');
const path = require('path');
const events = require('events');

throttledRequest.configure({
  requests: 2,
  milliseconds: 1000
}); //This will throttle the requests so no more than 3 are made every second

program
  .version('1.3.0')
  .option('-t, --simIdentifierType [simid, imsi or iccid]', 'Define whether you want to identiy your SIM by simid, imsi or iccid')
  .option('-l, --list [list of simids, imsis, or iccids]', 'List of simIdentifiers to be moved like 123,234')
  .option('-c, --csvFile [path]', 'Path to a file that contains a comma seperated list of simIdentifiers - NO headline')
  .option('-o, --destinationOrgId [orgId]', 'Destination organisation ID to move them to')
  .option('-d, --dryRun', 'Output changes without executing them live')
  .option('-t, --appToken [token]', 'Application token of the account you act from (MNO, Reseller, Service Provider)')
  .option('-e, --enterpriseAppToken [token]', 'Application token of the enterprise account you want to move the SIMs away from')
  .parse(process.argv);

const eventEmitter = new events.EventEmitter();

const API_URL = "https://cdn.emnify.net/api/v1";
let masterToken;
let enterpriseToken;
let identifiers;
let arrayOfSimIds;
getAuthToken(program.appToken, "master");
getAuthToken(program.enterpriseAppToken, "enterprise");


eventEmitter.on("enterprise authentication success", function(token) {
  enterpriseToken = token;
});

eventEmitter.on("master authentication success", function(token) {
  masterToken = token;
  identifiers = readList();
  if (program.simIdentifierType) {
    getSimIds(identifiers, program.simIdentifierType);
  }
  else {
    return console.error("No identifyer found, please specify if your input are of type imsi, iccid or simid");
  }
});

eventEmitter.on("simids pulled", function(simIds) {
  arrayOfSimIds = simIds;
  searchForEndpointsBySimId(arrayOfSimIds)
});

eventEmitter.on("endpoints pulled", function (endpointIds) {
  releaseSimsFromEndpoints(endpointIds);
});

eventEmitter.on("sims released from endpoints", function () {
  updateAllSimsOrgId(arrayOfSimIds);
});

function searchForEndpointsBySimId(simIds) {
let simsProcessed = 0;
(function () {
  let arrayOfEndpointIds = [];

  simIds.forEach(function (simId, index, array) {
    throttledRequest(API_URL + "/endpoint?page=1&per_page=2&q=sim:" + simId, {
      'auth': {
        'bearer': masterToken
      },
      json: true
    }, function (err, res, body) {
      if (err) {
        return console.error("Error getting the endpoint for simId", simid, err);
      }
      else if (!body.length) {
        console.log("SIM", simId, "is not connected to an endpoint");
        eventEmitter.emit("sims released from endpoints");
        return true;
      }
      else if (body.length > 1) {
        return console.error("SIM", simId, "matches more than one SIM.");
      }
      else if (res.statusCode === 200) {
        let endpointId = body[0].id;
        arrayOfEndpointIds.push(endpointId);
        console.log('SIM', simId, 'is connected to', endpointId);
        simsProcessed++;
        if (simsProcessed === array.length) {
          eventEmitter.emit("endpoints pulled", arrayOfEndpointIds);
          return arrayOfEndpointIds;
        }
      } else {
        return console.error("Errorcode", res.statusCode, "occured while getting endpoint for SIM", simId);
      }
    });
  });
})();
}

function releaseSimsFromEndpoints(endpointIds) {
    let endpointsProcessed = 0;
    endpointIds.forEach(function (endpointId, index, array) {
      if (program.dryRun) {
        console.log('DRY RUN: Release sim from endpoint', endpointId);
      } else {
        throttledRequest({
          method: 'PATCH',
          uri: API_URL + "/endpoint/" + endpointId,
          auth: {
            bearer: enterpriseToken
          },
          body: {
            sim: {
              id: null
            }
          },
          json: true
        }, function (err, res, body) {
          if (err) {
            return console.error("Error releasing the SIM for endpoint", endpointId, err);
          }
          else if (res.statusCode === 204) {
            console.log('Released sim from endpoint', endpointId);
            endpointsProcessed++;
            if (endpointsProcessed === array.length) {
              eventEmitter.emit("sims released from endpoints");
              return true;
            }
          } else {
            return console.error("Errorcode", res.statusCode, "occured while updating endpoint", endpointId);
          }
        });
      }
    });
}

function getAuthToken(token, orgType) {
  if (!token) {
    console.log("Missing a token, try executing --help to see how this script should be used");
    return false
  } else {
    request.post(API_URL + "/authenticate", {
      body: {
        "application_token": token
      },
      json: true
    }, function (err, res, body) {
      if (err) {
        return console.error("Error authenticating with the application token", err);
      }
      if (res.statusCode === 200) {
        console.log("Successfully authenticated using the application token");
        eventEmitter.emit(orgType + " authentication success", body.auth_token);
        return body.auth_token;
      }
      else {
        return console.error("Errorcode", res.statusCode, "occured while authenticating");
      }
    });
  }
}

function readList() {
  let identifiers;
  if (program.csvFile) {
    const filePath = path.join(__dirname, program.csvFile);
    fs.readFile(filePath, {
      encoding: 'utf-8'
    }, function (err, csvContent) {
      if (!err) {
        identifiers = csvContent.split(',');
        console.log("Sucessfully read the CSV file with the content", identifiers);
        return identifiers;
      } else {
        console.log(err);
      }
    });
  } else if (program.list) {
    identifiers = program.list.split(',');
    console.log("Sucessfully read the input from the CLI", identifiers);
    return identifiers;
  }
  else {
    return console.error("Missing identifiers to be moved, please specify a file or the list directly in the CLI");
  }
}

function getSimIds(identifiers, type) {
  if (type === "simid") {
    eventEmitter.emit("simids pulled", identifiers);
    return identifiers
  };

  let identifiersProcessed = 0;
  (function () {
    let arrayOfSimIds = [];
    identifiers.forEach(function (id, index, array) {
      throttledRequest(API_URL + "/sim?page=1&per_page=2&q=" + type + ":" + id, {
        'auth': {
          'bearer': masterToken
        },
        json: true
      }, function (err, res, body) {
        if (err) {
          return console.error("Error getting the SIM for", type, id, err);
        }
        else if (!body.length) {
          return console.error(type, id, "matches no SIM.");
        }
        else if (body.length > 1) {
          return console.error(type, id, "matches more than one SIM.");
        }
        else if (res.statusCode === 200) {
          let simId = body[0].id;
          arrayOfSimIds.push(simId);
          console.log('SIM ID for', type, id, 'is', simId);
          identifiersProcessed++;
          if (identifiersProcessed === array.length) {
            eventEmitter.emit("simids pulled", arrayOfSimIds);
            return arrayOfSimIds;
          }
        }
        else {
          return console.error("Errorcode", res.statusCode, "occured while getting SIM with", type, id);
        }
      });
    });
  })();
}

function updateAllSimsOrgId(simIds) {
  let simsProcessed = 0;
  simIds.forEach(function (simId, index, array) {
    if (program.dryRun) {
      console.log('DRY RUN: Update simId', simId, 'to organisation', program.destinationOrgId);
    }
    else {
      throttledRequest({
        method: 'PATCH',
        uri: API_URL + "/sim/" + simId,
        auth: {
          bearer: masterToken
        },
        body: {
          customer_org: {
            id: program.destinationOrgId
          },
        },
        json: true
      }, function (err, res, body) {
        if (err) {
          return console.error("Error patching the SIM for simId", simId, err);
        }
        else if (res.statusCode === 200) {
          console.log('Update simId', simId, 'to organisation', program.destinationOrgId);
          simsProcessed++;
          if (simsProcessed === array.length) {
            console.log("All completed");
          }
        }
        else {
          return console.error("Errorcode", res.statusCode, "occured while updating SIMid", simId);
        }
      });
    }
  });
}