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

const admin = require("firebase-admin");
const serviceAccount = require("./firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("bashabari");
    const usersCollection = db.collection("users");
    const propertiesCollection = db.collection("properties");
    const wishlistCollection= db.collection('wishlist')
    await propertiesCollection.createIndex({ agentEmail: 1 });

    //  show all properties

    // Get all verified properties
    /* app.get("/properties", async (req, res) => {
      try {
        const verifiedProperties = await propertiesCollection
          .find({ status: "verified"})
          .toArray();
        res.send(verifiedProperties);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch properties" });
      }
    }); */

    app.get("/properties", async (req, res) => {
      try {
        const status = req.query.status; // e.g., 'verified' or 'pending'
        const query = status ? { status } : {}; // if status provided, filter; else return all
        const properties = await propertiesCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(properties);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch properties" });
      }
    });

    // GET /verified-properties-by-agents  get all properties for all properties page
    app.get("/verified-properties-by-agents", async (req, res) => {
      try {
        const properties = await propertiesCollection
          .aggregate([
            {
              $match: { status: "verified" },
            },
            {
              $lookup: {
                from: "users",
                localField: "agentEmail",
                foreignField: "email",
                as: "agentInfo",
              },
            },
            {
              $unwind: "$agentInfo",
            },
            {
              $match: {
                "agentInfo.role": "agent",
                $or: [
                  { "agentInfo.status": { $exists: false } },
                  { "agentInfo.status": { $ne: "fraud" } },
                ],
              },
            },
            {
              $sort: { createdAt: -1 },
            },
          ])
          .toArray();

        res.send(properties);
      } catch (error) {
        console.error("Error fetching verified agent properties:", error);
        res.status(500).send({ error: "Failed to fetch verified properties" });
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

    // GET /users/:email  ==> prevent add properties marked frud
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send(user);
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

    // ====manageUsers.jsx====
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.patch("/users/role/:id", async (req, res) => {
      const { role } = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role } }
      );
      res.send(result);
    });

    app.patch("/users/fraud/:id", async (req, res) => {
      const userId = req.params.id;

      // 1. Update user status to fraud
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { status: "fraud" } }
      );

      // 2. Remove their properties from verified properties
      await propertiesCollection.updateMany(
        { agentId: userId },
        { $set: { status: "fraud-removed" } }
      );

      res.send({ message: "User marked as fraud and properties updated." });
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;

      // 1. Find user in MongoDB
      const user = await usersCollection.findOne({ _id: new ObjectId(id) });

      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      // 2. Delete from MongoDB
      await usersCollection.deleteOne({ _id: new ObjectId(id) });

      // 3. Delete from Firebase
      try {
        await admin.auth().deleteUser(user.firebaseUid);
        res.send({ message: "User deleted from DB and Firebase." });
      } catch (error) {
        console.error("Firebase deletion failed:", error);
        res.status(200).send({
          message: "User deleted from DB, but Firebase deletion failed.",
          firebaseError: error.message,
        });
      }
    });


    //  add to wishlist
    app.post("/wishlist", async (req, res) => {
  try {
    const data = req.body;
    const result = await wishlistCollection.insertOne(data);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Failed to add to wishlist" });
  }
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
