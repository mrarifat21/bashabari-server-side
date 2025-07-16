// server.js
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("bashabari");
    const usersCollection = db.collection("users");
    const propertiesCollection = db.collection("properties");

    /*   ========================================
      users relited API's
      ========================================== */

    // add user to db
    app.post("/users", async (req, res) => {
      const email = req.body.email;

      // Check if user already exists
      const userExists = await usersCollection.findOne({ email });
      if (userExists) {
        return res
          .status(200)
          .send({ message: "User already exists", inserted: false });
      }

      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send({ message: "User added", inserted: true, result });
    });

    /*   ========================================
      agent  relited API's
      ========================================== */
    //  add properties
    app.post("/properties", async (req, res) => {
      const property = req.body;

      // Validation: check required fields
      if (
        !property.title ||
        !property.location ||
        !property.image ||
        !property.priceMin ||
        !property.priceMax ||
        !property.agentName ||
        !property.agentEmail
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      property.status = "pending";
      property.createdAt = new Date();

      const result = await propertiesCollection.insertOne(property);
      res.send(result);
    });

    /**
     Get all properties - For testing
     */
    // app.get("/properties", async (req, res) => {
    //   const result = await propertiesCollection.find().toArray();
    //   res.send(result);
    // });

    // all propertise added by egnet
    app.get("/properties/agent", async (req, res) => {
      const email = req.query.email;
      const result = await propertiesCollection
        .find({ agentEmail: email })
        .toArray();
      res.send(result);
    });
   

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Basic route
app.get("/", (req, res) => {
  res.send("Bashabari backend is running");
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
