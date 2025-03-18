const crypto = require('crypto');
const readline = require('readline');

class Dice {
    constructor(values) {
        this.values = values;
    }
    roll(index) {
        return this.values[index];
    }
}

class Parser {
    static parseArgs(args) {
        if (args.length < 3) {
            throw new Error('Invalid input. Provide at least 3 dice configurations.');
        }
        return args.map(arg => {
            const values = arg.split(',').map(Number);
            if (values.some(isNaN)) {
                throw new Error(`Invalid dice values: ${arg}. Must be integers.`);
            }
            return new Dice(values);
        });
    }
}

class FairRandom {
    static generateRandom(range) {
        const key = crypto.randomBytes(32).toString('hex');
        const number = crypto.randomInt(0, range);
        const hmac = crypto.createHmac('sha3-256', key).update(number.toString()).digest('hex');
        return { number, key, hmac };
    }
}

class Probability {
    static countWins(userDie, compDie) {
        let winCount = 0;
        userDie.values.forEach(u => {
            compDie.values.forEach(c => {
                if (u > c) winCount++;
            });
        });
        return winCount;
    }

    static winProbability(userDie, compDie) {
        const totalComparisons = userDie.values.length * compDie.values.length;
        const winCount = this.countWins(userDie, compDie);
        return winCount / totalComparisons;
    }
}

class Game {
    constructor(diceSet) {
        this.diceSet = diceSet;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async askQuestion(query) {
        return new Promise(resolve => this.rl.question(query, answer => resolve(answer.trim())));
    }

    async start() {
        console.log("\n Game started. Determining who picks first...");
        const compChoice = FairRandom.generateRandom(2);
        console.log(`I selected a random value (HMAC=${compChoice.hmac})`);

        let userGuess;
        while (true) {
            userGuess = await this.askQuestion("Guess my value (0 or 1): ");
            if (userGuess === "0" || userGuess === "1") break;
            console.log(" Invalid input! Enter 0 or 1.");
        }

        console.log(`You chose: ${userGuess}`);
        console.log(`Actual number was: ${compChoice.number}`);
        console.log(`HMAC key: ${compChoice.key}`);

        let userFirst = parseInt(userGuess) === compChoice.number;
        console.log(userFirst ? "You pick first!" : "I pick first.");

        await this.selectDice(userFirst);
    }

    async selectDice(userFirst) {
        let availableDice = [...this.diceSet];
        let userDie, compDie;

        if (userFirst) {
            userDie = await this.chooseDice(availableDice, "Choose your dice:");
            availableDice = availableDice.filter(d => d !== userDie);
        }

        // Computer selects randomly
        const compChoiceIndex = crypto.randomInt(0, availableDice.length);
        compDie = availableDice[compChoiceIndex];
        console.log(`I choose: ${compDie.values.join(",")}`);

        if (!userFirst) {
            availableDice = availableDice.filter(d => d !== compDie);
            userDie = await this.chooseDice(availableDice, "Choose your dice:");
        }

        const probability = Probability.winProbability(userDie, compDie);
        console.log(`Win probability: ${(probability * 100).toFixed(2)}%`);

        await this.playRound(userDie, compDie);
    }

    async chooseDice(availableDice, prompt) {
        let choice;
        while (true) {
            console.log(prompt);
            availableDice.forEach((die, index) => {
                console.log(`${index}: ${die.values.join(',')}`);
            });

            choice = await this.askQuestion("Your selection: ");
            if (/^\d+$/.test(choice) && availableDice[parseInt(choice)]) break;
            console.log("Invalid selection! Choose a valid index.");
        }

        return availableDice[parseInt(choice)];
    }

    async playRound(userDie, compDie) {
        console.log("\nTime to roll!");
        const userRoll = await this.fairRoll(userDie);
        const compRoll = await this.fairRoll(compDie);
        console.log(`Your roll: ${userRoll} | My roll: ${compRoll}`);
        console.log(userRoll > compRoll ? "You win!" : "I win!");
        this.rl.close();
    }

    async fairRoll(die) {
        const rollProcess = FairRandom.generateRandom(die.values.length);
        console.log(`Rolling... (HMAC=${rollProcess.hmac})`);

        let userNumber;
        while (true) {
            userNumber = await this.askQuestion(`Add your number (0-${die.values.length - 1}): `);
            if (/^\d+$/.test(userNumber) && parseInt(userNumber) < die.values.length) break;
            console.log("Invalid input! Enter a valid number.");
        }

        const resultIndex = (parseInt(userNumber) + rollProcess.number) % die.values.length;
        console.log(`HMAC key: ${rollProcess.key}`);
        return die.roll(resultIndex);
    }
}

// Entry point
(async () => {
    try {
        const diceSet = Parser.parseArgs(process.argv.slice(2));
        const game = new Game(diceSet);
        await game.start();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        console.log("Usage: node Task_3.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3");
    }
})();
//1,2,3,4,5,6 1,2,3,4,5,6 1,2,3,4,5,6 1,2,3,4,5,6
//2,2,4,4,9,9 1,1,6,6,8,8 3,3,5,5,7,7