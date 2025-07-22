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
const decodedKey = Buffer.from(process.env.FB_Service_Key, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decodedKey);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// async function run() {
//   try {
// Connect the client to the server	(optional starting in v4.7)
// await client.connect();
const db = client.db("bashabari");
const usersCollection = db.collection("users");
const propertiesCollection = db.collection("properties");
const wishlistCollection = db.collection("wishlist");
const reviewsCollection = db.collection("reviews");
const offersCollection = db.collection("offer");

// home page
app.get("/properties/advertised", async (req, res) => {
  try {
    const advertisedProperties = await propertiesCollection
      .aggregate([
        {
          $match: {
            isAdvertised: true,
            status: "verified",
          },
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
            "agentInfo.status": { $ne: "fraud" }, // Exclude fraud agents
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $limit: 4,
        },
        {
          $project: {
            image: 1,
            title: 1,
            location: 1,
            priceMin: 1,
            priceMax: 1,
            status: 1,
            agentName: "$agentInfo.name",
          },
        },
      ])
      .toArray();

    res.send(advertisedProperties);
  } catch (error) {
    console.error("Failed to fetch advertised properties", error);
    res.status(500).send({ error: "Failed to fetch advertised properties" });
  }
});

// GET: /reviews/latest for home page
app.get("/reviews/latest", async (req, res) => {
  try {
    const reviews = await reviewsCollection
      .find()
      .sort({ createdAt: -1 }) // latest first
      .limit(3)
      .toArray();
    res.send(reviews);
  } catch (error) {
    console.error("Error fetching latest reviews:", error);
    res.status(500).send({ error: "Failed to fetch latest reviews" });
  }
});

// ====
// GET: Get user role by email
app.get("/users/:email/role", async (req, res) => {
  try {
    const email = req.params.email;

    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send({ role: user.role || "user" });
  } catch (error) {
    console.error("Error getting user role:", error);
    res.status(500).send({ message: "Failed to get role" });
  }
});

// =====

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
          $unwind: {
            path: "$agentInfo",
            preserveNullAndEmptyArrays: true, //  allow properties even if agent is deleted
          },
        },
        {
          $match: {
            $or: [
              {
                "agentInfo.role": "agent",
                $or: [
                  { "agentInfo.status": { $exists: false } },
                  { "agentInfo.status": { $ne: "fraud" } },
                ],
              },
              { agentInfo: null }, // 👈 include if agentInfo is missing (user deleted)
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

app.get("/reviews/user", async (req, res) => {
  try {
    const email = req.query.email;
    const result = await reviewsCollection
      .find({ userEmail: email }) // <-- FIXED LINE
      .toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Failed to load your reviews." });
  }
});

//  wish list in user dashboard
app.get("/wishlist", async (req, res) => {
  const email = req.query.email;
  const result = await wishlistCollection.find({ userEmail: email }).toArray();
  res.send(result);
});

app.get("/wishlist/:id", async (req, res) => {
  const id = req.params.id;
  const result = await wishlistCollection.findOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});

app.delete("/wishlist/:id", async (req, res) => {
  const id = req.params.id;
  const result = await wishlistCollection.deleteOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});

// make an offer
app.post("/offers", async (req, res) => {
  const offer = req.body;
  if (
    !offer.buyerEmail ||
    offer.offerAmount < offer.priceMin ||
    offer.offerAmount > offer.priceMax
  ) {
    return res.status(400).send({ message: "Invalid offer" });
  }

  const result = await offersCollection.insertOne(offer);
  res.send(result);
});
// property bougth
// Get offers by user email
app.get("/offers/user", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).send({ error: "Email query required" });

  try {
    const offers = await offersCollection.find({ buyerEmail: email }).toArray();
    res.send(offers);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// store offer in the database
// ✅ Add this route to handle offers
app.post("/offers", async (req, res) => {
  try {
    const offerData = req.body;

    // Optional: Add server-side validation if needed
    if (
      !offerData.propertyId ||
      !offerData.buyerEmail ||
      !offerData.offerAmount
    ) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    offerData.createdAt = new Date(); // Add timestamp if needed

    const result = await offersCollection.insertOne(offerData);
    res.send(result);
  } catch (error) {
    console.error("Failed to insert offer:", error);
    res.status(500).send({ error: "Failed to submit offer" });
  }
});
app.get("/offer/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const offer = await offersCollection.findOne({ _id: new ObjectId(id) });
    if (!offer) {
      return res.status(404).send({ message: "Offer not found" });
    }
    res.send(offer);
  } catch (error) {
    console.error("Error fetching offer:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});



// Update offer status after payment (mock)
/* app.patch("/offers/pay/:id", async (req, res) => {
  const id = req.params.id;
  const { status, transactionId } = req.body;

  if (!ObjectId.isValid(id)) return res.status(400).send({ error: "Invalid ID" });

  try {
    const updateResult = await offersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, transactionId } }
    );

    if (updateResult.modifiedCount === 1) {
      res.send({ message: "Payment status updated" });
    } else {
      res.status(404).send({ error: "Offer not found" });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}); */

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

  const result = await propertiesCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...updatedProperty, status: "pending" } }
  );
  // console.log("Update result:", result);
  res.send(result);
});

// Get all offers for properties added by the agent
app.get("/offers/agent", async (req, res) => {
  const email = req.query.email;
  try {
    const offers = await offersCollection
      .find({ agentEmail: email })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(offers);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch offers" });
  }
});

// Update offer status (accept or reject)
app.patch("/offers/update-status/:id", async (req, res) => {
  const id = req.params.id;
  const { status, propertyId } = req.body;

  try {
    const objectId = new ObjectId(id);

    // Update the selected offer's status
    const updateSelected = await offersCollection.updateOne(
      { _id: objectId },
      { $set: { status } }
    );

    let rejectedOffers = { modifiedCount: 0 };

    // If accepted, reject all other offers for the same property
    if (status === "accepted") {
      console.log(
        "Rejecting other offers for property:",
        propertyId,
        "excluding offer:",
        id
      );

      rejectedOffers = await offersCollection.updateMany(
        {
          propertyId: propertyId,
          _id: { $ne: objectId },
        },
        { $set: { status: "rejected" } }
      );
    }

    res.send({
      message: "Offer status updated",
      updatedOffers: updateSelected.modifiedCount,
      rejectedOffers: rejectedOffers.modifiedCount,
    });
  } catch (err) {
    console.error("Error updating offer status:", err);
    res.status(500).send({ error: "Failed to update offer status" });
  }
});

/* =================
      Admin Relited ApI's
  ==================== */

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
// manage rewiew
// GET all reviews (Admin only)
app.get("/admin/reviews", async (req, res) => {
  try {
    const result = await db.collection("reviews").find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Failed to fetch reviews" });
  }
});
// DELETE a specific review by ID
app.delete("/admin/reviews/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db
      .collection("reviews")
      .deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Failed to delete review" });
  }
});
// add section============

// PATCH update property to mark as advertised
app.patch("/advertise/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid property ID" });
    }

    // Set isAdvertised = true
    const result = await propertiesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isAdvertised: true } }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .send({ error: "Property not found or already advertised" });
    }

    res.send({ message: "Property advertised successfully" });
  } catch (error) {
    console.error("Error advertising property:", error);
    res.status(500).send({ error: "Failed to advertise property" });
  }
});

// ============

//  add to wishlist button
app.post("/wishlist", async (req, res) => {
  try {
    const newItem = {
      ...req.body,
      propertyId: String(req.body.propertyId), // 🔁 Ensure propertyId is string
    };

    const exists = await wishlistCollection.findOne({
      userEmail: newItem.userEmail,
      propertyId: newItem.propertyId,
    });

    if (exists) {
      return res.status(400).send({ message: "Already added" });
    }

    const result = await wishlistCollection.insertOne(newItem);
    res.send(result);
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Check if property is already in wishlist
app.get("/wishlist/check", async (req, res) => {
  const { email, propertyId } = req.query;

  try {
    const exists = await wishlistCollection.findOne({
      userEmail: email,
      propertyId: String(propertyId), // 🔁 Ensure it's string
    });

    res.send({ exists: !!exists });
  } catch (error) {
    console.error("Error checking wishlist:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// POST /reviews
app.post("/reviews", async (req, res) => {
  try {
    const review = req.body;
    review.createdAt = new Date(); // ✅ Add this
    const result = await db.collection("reviews").insertOne(review);
    res.send(result);
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).send({ error: "Failed to add review" });
  }
});

// GET /reviews/:propertyId
app.get("/reviews/:propertyId", async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const reviews = await reviewsCollection
      .find({ propertyId: propertyId }) // Make sure propertyId in DB is a string
      .sort({ createdAt: -1 })
      .toArray();

    res.send(reviews);
  } catch (err) {
    console.error("Error fetching reviews by propertyId:", err);
    res
      .status(500)
      .send({ error: "Failed to fetch reviews for this property" });
  }
});

app.delete("/reviews/:id", async (req, res) => {
  try {
    const reviewId = req.params.id;
    const result = await reviewsCollection.deleteOne({
      _id: new ObjectId(reviewId),
    });
    res.send(result);
  } catch (err) {
    console.error("Error deleting review:", err);
    res.status(500).send({ error: "Failed to delete review" });
  }
});

// Send a ping to confirm a successful connection
// await client.db("admin").command({ ping: 1 });
// console.log(
//   "Pinged your deployment. You successfully connected to MongoDB!"
// );
// } finally {
// Ensures that the client will close when you finish/error
// await client.close();
//   }
// }
// run().catch(console.dir);

// Basic route
app.get("/", (req, res) => {
  res.send("Bashabari backend is running");
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
