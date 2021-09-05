const truffleAssert = require('truffle-assertions');

const appContractDefinition = artifacts.require('FlightSuretyApp');
const dataContractDefinition = artifacts.require('FlightSuretyData');

contract('Oracles', accounts => {

    const TEST_ORACLES_COUNT = 20;

    // Watch contract events
    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;

    // Initialize users with accounts
    const owner = accounts[0]; //Also airline number one
    const passengerOne = accounts[25];

  describe('Criteria: Oracle (registerOracle)', () => {
    before(async() => {
      const dataContract = await dataContractDefinition.new({from:owner});
      appContract = await appContractDefinition.new(dataContract.address, {from:owner});
    });

    it('Cannot register Oracle if mimimum fee is not paid', async() => {
      await truffleAssert.reverts(appContract.registerOracle({from: accounts[6]}), 'Registration fee is required');
    });

    it('Can register Oracle', async() => {
        await appContract.registerOracle({from: accounts[6], value: web3.utils.toWei('1', 'ether')});
    });

    it('Cannot register Oracle twice', async() => {
        await truffleAssert.reverts(appContract.registerOracle({from: accounts[6], value: web3.utils.toWei('1', 'ether')}), 'Oracle already registered');
    });
  });

  describe('Criteria: Oracle (Oracle Functions, Oracle Initialization, Updates) && Passengers (Passenger Repayment, Withdraw, and Insurance Payouts)', () => {
    let correctIndex;
    let oraclesMap = new Map();
    let matchingIndexOracles = [];

    // ARRANGE
    before(async() => {
        dataContract = await dataContractDefinition.new({from:owner});
        appContract = await appContractDefinition.new(dataContract.address, {from:owner});
        await appContract.fund({from: owner, value: web3.utils.toWei('10', 'ether').toString()});
        await appContract.registerFlight(owner, "UA8080", 1111111111, {from: owner});
        let result = await appContract.fetchFlightStatus(owner, "UA8080", 1111111111);
        truffleAssert.eventEmitted(result, 'OracleRequest', (ev) => {
            correctIndex = Number(ev.index);
            return true;
        });
    
        // ACT
        for (let a = 1; a <= TEST_ORACLES_COUNT; a++) {
            await appContract.registerOracle({from: accounts[a], value: web3.utils.toWei('1', 'ether')});
            let indexes = await appContract.getMyIndexes.call({from: accounts[a]});
            oraclesMap.set(accounts[a], [Number(indexes[0]), Number(indexes[1]), Number(indexes[2])]); 
        }

        getOracles(correctIndex);
        await appContract.buy(owner, "UA8080", 1111111111, {from: passengerOne, value: web3.utils.toWei('1', 'ether')});
        await appContract.submitOracleResponse(correctIndex, owner, "UA8080", 1111111111, STATUS_CODE_LATE_AIRLINE, {from: matchingIndexOracles[0]});
        await appContract.submitOracleResponse(correctIndex, owner, "UA8080", 1111111111, STATUS_CODE_LATE_AIRLINE, {from: matchingIndexOracles[1]});
        await appContract.submitOracleResponse(correctIndex, owner, "UA8080", 1111111111, STATUS_CODE_LATE_AIRLINE, {from: matchingIndexOracles[2]});
    });

    it('Credit passenger and enable withdrawal of the insurance payout after receiving a response from Oracles', async() => {
        let passengerBalancePrior = await web3.eth.getBalance(passengerOne);
        let contractBalancePrior = await web3.eth.getBalance(dataContract.address);
        await appContract.withdraw(web3.utils.toWei('1', 'ether'), {from: passengerOne});

        let passengerBalanceAfter = await web3.eth.getBalance(passengerOne);
        let contractBalanceAfter = await web3.eth.getBalance(dataContract.address);

        const estimatedGasCost = web3.utils.toWei('0.3', 'ether');
        assert.equal(Number(contractBalancePrior) - Number(web3.utils.toWei('1', 'ether')), Number(contractBalanceAfter), 'Contract did not pay out funds correctly')
        expect(Number(passengerBalanceAfter) - Number(passengerBalancePrior)).to.be.within(Number(estimatedGasCost), Number(web3.utils.toWei('1', 'ether')));
    });    

    const getOracles = (correctIndex) => {
        matchingIndexOracles = [];
        for (let [address, indexes] of oraclesMap) {
            indexes.forEach(index => {
                if (index == correctIndex){
                    matchingIndexOracles.push(address);
                }
            });
        }
    }
});

});
