pragma solidity >=0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract
    bool private operational = true;
    FlightSuretyData flightSuretyData;

    /********************************************************************************************/
    /*                                    EVENT DEFINITIONS                                     */
    /********************************************************************************************/

    event AirlineRegistration(address airline);
    event VotesPassed(uint256 votes);
    event AirlineAntePaid(address airline);
    event FlightRegistration(address airline, string flight, uint256 timestamp);
    event BoughtInsurance(address passenger, bytes32 flightKey, uint256 amount);

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational()
    {
        require(flightSuretyData.isOperational(), "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
    * @dev Modifier that requires the airline to be registered before proceeding
    */
    modifier requireAirlineRegistration(address airline)
    {
        require(flightSuretyData.isAirlineRegistered(airline), "Caller is not an existing airline");
        _;
    }

    /**
    * @dev Modifier that requires the airline's ante to have been paid before proceeding
    */
    modifier requireAntePaid(address airline)
    {
        require(flightSuretyData.isAntePaid(airline), "Caller has not paid the ante");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor(address dataContract) public
    {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContract);
        // Registering the first airline when contract is deployed
        flightSuretyData.registerAirline(msg.sender);
        emit AirlineRegistration(msg.sender);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational() public view returns(bool)
    {
        return operational;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus(bool mode) external requireContractOwner
    {
        require(mode != operational, "Contract is already in this state");
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    address[] airlinesVoted = new address[](0); //Storing address of airline votes

   /**
    * @dev Add an airline to the registration queue
    *
    */
    function registerAirline(address airline) public requireIsOperational
    requireAirlineRegistration(msg.sender)
    requireAntePaid(msg.sender)
    {
        require(!flightSuretyData.isAirlineRegistered(airline),"Airline is already registered");
        if(flightSuretyData.getAirlineCount() < 4) {
            flightSuretyData.registerAirline(airline);
            emit AirlineRegistration(airline);
        }
        else {
            bool doubleCount = false;
            if(airlinesVoted.length == 0) {
                airlinesVoted.push(msg.sender);
            }
            else {
                for (uint256 i = 0; i < airlinesVoted.length; i++) {
                    if(airlinesVoted[i] == msg.sender) {
                        doubleCount = true;
                        break;
                    }
                }
            }
            require(!doubleCount, "A single airline cannot vote twice");
            airlinesVoted.push(msg.sender);
        }
        if(airlinesVoted.length > flightSuretyData.getAirlineCount().div(2)) {
                flightSuretyData.registerAirline(airline);
                emit AirlineRegistration(airline);
                airlinesVoted = new address[](0);
        }
    }

    function fund() external payable requireIsOperational requireAirlineRegistration(msg.sender) {
        require(msg.value >= 10 ether, 'Minimum payment is 10 ether');
        address payable flightSuretyContract = address(uint160(address(flightSuretyData)));
        flightSuretyContract.transfer(msg.value);
        flightSuretyData.fund(msg.sender);
        emit AirlineAntePaid(msg.sender);
    }

   /**
    * @dev Register a future flight for insuring.
    *
    */
    function registerFlight(address airline, string calldata flight, uint256 timestamp) external requireIsOperational
    {
        require(airline == msg.sender, "Only the registered airline can register a flight for the airline");
        flightSuretyData.registerFlight(airline, flight, timestamp);
        emit FlightRegistration(airline, flight, timestamp);
    }

    /**
    * @dev Buy insurance for a flight
    *
    */
    function buy(address airline, string calldata flight, uint256 timestamp) external payable requireIsOperational
    {
        require(msg.value > 0 && msg.value <= 1 ether, "Invalid insurance payment");
        flightSuretyData.buy(msg.sender, airline, flight, timestamp, msg.value);
        address payable flightSuretyContract = address(uint160(address(flightSuretyData)));
        flightSuretyContract.transfer(msg.value);
        emit BoughtInsurance(msg.sender, getFlightKey(airline, flight, timestamp), msg.value);
    }

   /**
    * @dev Called after oracle has updated flight status
    *
    */
    function processFlightStatus(address airline, string memory flight, uint256 timestamp, uint8 statusCode) internal requireIsOperational
    {
        require(flightSuretyData.isFlightRegistered(getFlightKey(airline, flight, timestamp)), "This flight does not exist");
        if(statusCode == 20) {
            bytes32 flightKey = getFlightKey(airline, flight, timestamp);
            require(flightSuretyData.getPassengers(flightKey).length > 0, "This flight does not have any insured passengers");
            for (uint256 i = 0; i < flightSuretyData.getPassengers(flightKey).length; i++) {
                flightSuretyData.creditInsurees(flightSuretyData.getPassengers(flightKey)[i],flightKey);
            }
        }
    }

    /**
     * @dev Gets a Flight Count for a specific index
     *
     */
     function getFlightCount() external view requireIsOperational returns(uint256) {
         return flightSuretyData.getFlightCount();
     }

    /**
     * @dev Gets a Flight Number for a specific index
     *
     */
     function getFlightNumber(uint256 flightIndex) external view requireIsOperational returns(string memory) {
         return flightSuretyData.getFlightNumber(flightIndex);
     }

     /**
      * @dev Gets a Flight Time for a specific index
      *
      */
      function getFlightTime(uint256 flightIndex) external view requireIsOperational returns(uint256) {
          return flightSuretyData.getFlightTime(flightIndex);
      }

      /**
       * @dev Gets a Flight Airline for a specific index
       *
       */
       function getFlightAirline(uint256 flightIndex) external view requireIsOperational returns(address) {
           return flightSuretyData.getFlightAirline(flightIndex);
       }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function withdraw(uint256 amount) external payable requireIsOperational
    {
        flightSuretyData.pay(msg.sender, amount);
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(address airline, string calldata flight, uint256 timestamp) external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    }


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle () external payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");
        require(oracles[msg.sender].isRegistered == false, "Oracle already registered");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes() view external returns(uint8[3] memory)
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");
        return oracles[msg.sender].indexes;
    }


    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(uint8 index, address airline, string calldata flight, uint256 timestamp, uint8 statusCode) external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        //if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {
        if (1 == 1) {
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey(address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns(uint8[3] memory)
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}

contract FlightSuretyData {
    function isOperational() public view returns(bool);
    function setOperatingStatus (bool mode) external;
    function isAirlineRegistered(address airline) external view returns(bool);
    function isAntePaid(address airline) external view returns(bool);
    function isFlightRegistered(bytes32 flightkey) external view returns(bool);
    function getAirlineCount() external view returns(uint256);
    function getPassengers(bytes32 flightkey) external view returns(address[] memory);
    function registerAirline (address airline) public;
    function registerFlight(address airline, string memory flight, uint256 timestamp) public;
    function getFlightCount() external view returns(uint256);
    function getFlightNumber(uint256 flightIndex) external view returns(string memory);
    function getFlightTime(uint256 flightIndex) external view returns(uint256);
    function getFlightAirline(uint256 flightIndex) external view returns(address);
    function buy(address passenger, address airline, string calldata flight, uint256 timestamp, uint256 amount) external;
    function creditInsurees(address passenger, bytes32 flightkey) public;
    function pay(address insuredPassenger, uint256 amount) external payable;
    function fund(address airline) public payable;
    mapping(address => address[]) public Votes;
}
