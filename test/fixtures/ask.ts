// Asks the questions given as arguments and prints every answer as JSON.
// A question "name=Guest" asks "name" with the default value "Guest".
import { prompt } from "../../dist/index.js";

for (const question of process.argv.slice(2)) {
  const [message, defaultValue] = question.split("=");
  const answer = prompt(message, defaultValue);
  console.log(JSON.stringify(answer));
}
