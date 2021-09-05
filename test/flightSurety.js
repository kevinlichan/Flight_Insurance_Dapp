const truffleAssert = require('truffle-assertions');

const appContractDefinition = artifacts.require('FlightSuretyApp');
const dataContractDefinition = artifacts.require('FlightSuretyData');

contract('FlightSuretyApp', accounts => {
    const owner = accounts[0]; //Also airline number one
    const airlineTwo = accounts[1];
    const airlineThree = accounts[2];
    const airlineFour = accounts[3];
    const airlineFive = accounts[4];
    const passengerOne = accounts[5];
    let appContract;

    describe ('Criteria: Separation of Concerns and Operational Control', () => {
        before(async() => {
            const dataContract = await dataContractDefinition.new({from:owner});
            appContract = await appContractDefinition.new(dataContract.address, {from:owner});
        });

        it('Contract is operational after deployment', async() => {
            let isOperational = await appContract.isOperational.call({from: owner});
            assert.equal(isOperational, true, 'Contract operational mode should be set to true');
        });

        it('Only the Owner of the Contract should be allowed to set the operating status', async() => {
            await truffleAssert.reverts(appContract.setOperatingStatus(false, {from: accounts[1]}), 'Caller is not contract owner');
        });

        it('Allow the owner to setOperatingStatus', async() => {
            let isOperational = await appContract.isOperational.call({from: owner});
            assert.equal(isOperational, true, 'Contract operational mode should be set to true');
            await appContract.setOperatingStatus(false, {from: owner});
            isOperational = await appContract.isOperational.call({from: owner});
            assert.equal(isOperational, false, 'Contract operational mode should be set to false');
        });
    });

    describe('Criteria: Airlines (Fund and Register Airlines)', () => {
        let dataContract
        before(async() => {
            dataContract = await dataContractDefinition.new({from:owner});
            appContract = await appContractDefinition.new(dataContract.address, {from:owner});
        });

        it('Only existing / registered airlines can register more airlines', async() => {
            await truffleAssert.reverts(appContract.registerAirline(airlineTwo, {from: accounts[1]}), 'Caller is not an existing airline');
        });

        it('Only existing / registered airlines can fund the Contract', async() => {
            await truffleAssert.reverts(appContract.fund({from: accounts[1], value: web3.utils.toWei('10', 'ether')}), 'Caller is not an existing airline');
        });

        it('Revert if the airlines fund less than the minimum 10 ethers', async() => {
            await truffleAssert.reverts(appContract.fund({from: owner, value: web3.utils.toWei('2', 'ether')}), 'Minimum payment is 10 ether');
        });

        it('Allow the airline to pay the ante (fund) to the Contract', async() => {
            let contractBalancePrior = await web3.eth.getBalance(dataContract.address);
            let result = await appContract.fund({from: owner, value: web3.utils.toWei('10', 'ether').toString()});
            let contractBalanceAfter = await web3.eth.getBalance(dataContract.address);
            truffleAssert.eventEmitted(result, 'AirlineAntePaid');
            assert.equal(Number(contractBalancePrior) + Number(web3.utils.toWei('10', 'ether')), Number(contractBalanceAfter), 'Contract was not paid correctly');
        });
  
          it('Allow a registered and funded airline to register other airlines', async() => {
            await appContract.fund({from: owner, value: web3.utils.toWei('10', 'ether').toString()});
            let result = await appContract.registerAirline(airlineTwo, {from: owner});
            truffleAssert.eventEmitted(result, 'AirlineRegistration');
          });
  
          it('Multi-party consensus: Allow the registration of the 5th and beyond airline through a voting process', async() => {
            await appContract.fund({from: airlineTwo, value: web3.utils.toWei('10', 'ether').toString()});
            await appContract.registerAirline(airlineThree, {from: owner});
            await appContract.fund({from: airlineThree, value: web3.utils.toWei('10', 'ether').toString()});
            await appContract.registerAirline(airlineFour, {from: owner});
            await appContract.fund({from: airlineFour, value: web3.utils.toWei('10', 'ether').toString()});
            await appContract.registerAirline(airlineFive, {from: owner});
            await truffleAssert.reverts(appContract.fund({from: airlineFive, value: web3.utils.toWei('10', 'ether')}), 'Caller is not an existing airline');
            let result = await appContract.registerAirline(airlineFive, {from: airlineTwo});
            truffleAssert.eventEmitted(result, 'AirlineRegistration');
          });

    });

    describe('Criteria: Airlines (Register Flights) and Passengers (Buy Insurance)', () => {
        let dataContract
        before(async() => {
            dataContract = await dataContractDefinition.new({from:owner});
            appContract = await appContractDefinition.new(dataContract.address, {from:owner});
        });

        it('Only registered and funded airlines should be able to register a flight', async() => {
            await truffleAssert.reverts(appContract.registerFlight(airlineTwo, "FakeFlight", 1111111111, {from: accounts[9]}), 'Only the registered airline can register a flight for the airline');
            await truffleAssert.reverts(appContract.registerFlight(owner, "UA8080", 1111111111, {from: owner}), 'Caller has not paid the ante');
        });

        it('Allow registered and funded airlines to register a flight', async() => {
            await appContract.fund({from: owner, value: web3.utils.toWei('10', 'ether').toString()});
            let result = await appContract.registerFlight(owner, "UA8080", 1111111111, {from: owner})
            truffleAssert.eventEmitted(result, 'FlightRegistration');
        });

        it('Cannot register another flight with the same Flight Key', async() => {
            await truffleAssert.reverts(appContract.registerFlight(owner, "UA8080", 1111111111, {from: owner}), 'Flight has already been registered');
        });

        it('Passengers can buy insurance but the value cannot be more than 1 ether', async() => {
            await truffleAssert.reverts(appContract.buy(owner, "UA8080", 1111111111, {from: passengerOne, value: web3.utils.toWei('2', 'ether')}), 'Invalid insurance payment');
        });

        it('Passenger can buy insurance for a registered flight', async() => {
            const contractBalancePrior = await web3.eth.getBalance(dataContract.address);
            let result = await appContract.buy(owner, "UA8080", 1111111111, {from: passengerOne, value: web3.utils.toWei('1', 'ether')});
            truffleAssert.eventEmitted(result, 'BoughtInsurance');

            const contractBalanceAfter = await web3.eth.getBalance(dataContract.address);
            assert.equal(Number(contractBalancePrior) + Number(web3.utils.toWei('1', 'ether')), Number(contractBalanceAfter), 'Contract was not paid correctly');
        });
    });
});
