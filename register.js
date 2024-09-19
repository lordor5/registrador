const puppeteer = require("puppeteer");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

async function main() {
  const delay = calculateDelayUntil10AM();

  // Delay the execution until 10 AM Spain time
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Load the time from the time.json file
  const { registros } = JSON.parse(fs.readFileSync("time.json"));
  console.log(registros);

  let arr = await register(registros);
  console.log(arr);
  while (arr.length !== 0) {
    await new Promise((resolve) => setTimeout(resolve, 300000)); //300000 = 5 minutos
    arr = await register(arr);
    console.log(arr);
  }
}
main();

async function register(arr) {
  const browser = await puppeteer.launch({
    headless: true,
  }); // Change to true for headless mode
  const page = await browser.newPage();

  // Navigate to the login page
  await page.goto(
    "https://intranet.upv.es/pls/soalu/est_intranet.NI_Dual?P_IDIOMA=c"
  );

  // Fill in the username and password
  await page.type('input[name="dni"]', process.env.DNI);
  await page.type('input[name="clau"]', process.env.PASSWORD);

  // Submit the login form
  await page.click('input[type="submit"]');

  // Navigate to the registration page
  await page.goto(
    "https://intranet.upv.es/pls/soalu/sic_depact.HSemActividades?p_campus=V&p_tipoact=6799&p_codacti=21549&p_vista=intranet&p_idioma=c&p_solo_matricula_sn=&p_anc=filtro_actividad"
  );

  // Listen for console messages from the browser context
  page.on("console", (msg) => {
    // Output browser's console messages to Node.js console
    console.log(`BROWSER LOG: ${msg.text()}`);
  });

  // Click on the available slot (adjust the selector for the specific time you want)
  newArr = await page.evaluate(async (arr) => {
    // Helper function to create a delay
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    //let newArr = [];
    for (let i = 0; i < arr.length; i++) {
      // Find the anchor tag that contains 'MUS068' in its text
      console.log(arr[i]);
      const link = Array.from(document.querySelectorAll("a")).find((a) =>
        a.innerText.includes(arr[i])
      );

      // If the link is found, click on it
      if (link) {
        link.click();
        console.log("registrado en: ", arr[i]);
        arr.splice(i, 1);
        i--;
        //newArr.push(registro);
        await delay(500);
      }
    }
    return arr;
  }, arr);

  // Close the browser after actions
  await browser.close();

  return newArr;
}

// Helper function to calculate delay until 10 AM in Spain (CET)
function calculateDelayUntil10AM() {
  const now = new Date();

  // Spain is usually in the Central European Time (CET) zone, UTC+1 or UTC+2 (during daylight saving time)
  const currentOffset = now.getTimezoneOffset(); // in minutes
  const spainOffset = -120; // Assuming it's UTC+2 for Daylight Saving Time (adjust accordingly)

  // Convert current time to Spain's time by adjusting the timezone offset
  now.setMinutes(now.getMinutes() + currentOffset - spainOffset);

  // Set the target time to 10:00 AM in Spain
  const targetTime = new Date(now);
  targetTime.setHours(10, 0, 20, 0); // 10:00 AM

  let delay = targetTime - now;

  // If it's already past 10:00 AM today, set the target to 10:00 AM tomorrow
  if (now > targetTime) {
    delay = 0; // Set to the next day
  }

  console.log(`Waiting ${delay / 1000 / 60} minutes until 10 AM Spain time...`);
  return delay;
}
