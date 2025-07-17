// server.js
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    await propertiesCollection.createIndex({ agentEmail: 1 });

    //  show all properties

    // Get all verified properties
    // app.get("/properties", async (req, res) => {
    //   try {
    //     const verifiedProperties = await propertiesCollection
    //       .find({ status: "verified"})
    //       .toArray();
    //     res.send(verifiedProperties);
    //   } catch (error) {
    //     res.status(500).send({ error: "Failed to fetch properties" });
    //   }
    // });

    app.get("/properties", async (req, res) => {
      try {
        const status = req.query.status; // e.g., 'verified' or 'pending'
        const query = status ? { status } : {}; // if status provided, filter; else return all
        const properties = await propertiesCollection.find(query).toArray();
        res.send(properties);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch properties" });
      }
    });

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
      try {
        const email = req.query.email;
        const result = await propertiesCollection
          .find({ agentEmail: email })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch agent properties" });
      }
    });
    // get single property by id for updatePorperty.jsx
    // app.get("/properties/:id", async (req, res) => {
    //   const id = req.params.id;

    //   try {
    //     const property = await propertiesCollection.findOne({
    //       _id: new ObjectId(id),
    //     });

    //     if (!property) {
    //       return res.status(404).send({ message: "Property not found" });
    //     }

    //     res.send(property);
    //   } catch (err) {
    //     res.status(500).send({ error: "Failed to fetch property" });
    //   }
    // });

    //  delete properties
    app.delete("/properties/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await propertiesCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to delete property" });
      }
    });

    // update properties
    app.patch("/properties/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProperty = req.body;
      // console.log("Update request for property ID:", id);
      // console.log("Update data:", updatedProperty);

      const result = await propertiesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updatedProperty, status: "pending" } }
      );
      // console.log("Update result:", result);
      res.send(result);
    });

    /* =================
      Admin Relited ApI's
  ==================== */
    // Get all pending properties

    // app.get("/properties/pending", async (req, res) => {
    //   try {
    //     const pendingProperties = await propertiesCollection
    //       .find({ status: "pending" })
    //       .toArray();
    //     res.send(pendingProperties);
    //   } catch (error) {
    //     console.error("Error fetching pending properties:", error);
    //     res.status(500).send({ error: "Failed to fetch pending properties" });
    //   }
    // });

    // get single property by id for updatePorperty.jsx
    app.get("/properties/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const property = await propertiesCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!property) {
          return res.status(404).send({ message: "Property not found" });
        }

        res.send(property);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch property" });
      }
    });

    // PATCH /properties/status/:id
    app.patch("/properties/status/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      const result = await propertiesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
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
