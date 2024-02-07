#  Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# Description: This file contains the class labels for an image classification dataset.
class_labels = [
  #Animals
  'cat', 'dog', 'bird', 'horse', 'fish', 'reptile', 'amphibian', 'insect', 'mammal', 'aquatic_animal',
  'tiger', 'lion', 'bear', 'elephant', 'giraffe', 'zebra', 'monkey', 'kangaroo', 'koala', 'panda', 'penguin',
  'rabbit', 'hamster', 'squirrel', 'mouse', 'rat', 'bat', 'snake', 'lizard', 'turtle', 'crocodile', 'frog',
  'toad', 'shark', 'whale', 'dolphin', 'fish', 'octopus', 'squid', 'jellyfish', 'starfish', 'crab',
  'lobster', 'shrimp', 'bee', 'ant', 'butterfly', 'dragonfly', 'beetle', 'ladybug', 'grasshopper', 'cricket',
  'cockroach', 'spider', 'scorpion', 'snail', 'worm', 'caterpillar', 'mosquito',
  'fly',

  #Plants
  'tree', 'flower', 'grass', 'bush', 'cactus', 'plant', 'fruit', 'vegetable', 'grain',
  'rose', 'daisy', 'sunflower', 'tulip', 'lily', 'orchid',
  'bluebell', 'violet', 'cactus', 'mushroom', 'seaweed', 'algae',
  'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'strawberry', 'blueberry', 'raspberry', 'blackberry',
  'watermelon', 'melon', 'pineapple', 'pear', 'peach', 'plum', 'cherry', 'apricot', 'coconut', 'kiwi', 'mango',
  'papaya', 'avocado', 'corn', 'potato', 'tomato', 'carrot', 'onion', 'garlic', 'broccoli', 'cabbage',
  'lettuce', 'spinach', 'cucumber', 'pepper', 'pumpkin', 'eggplant', 'radish', 'turnip', 'beet',
  'wheat', 'oat',

  #Geographical features
  'mountain', 'hill', 'plateau', 'ridge', 'glacier', 'volcano', 'canyon', 'valley', 'ocean', 'beach', 'lake', 
  'river', 'forest', 'desert', 'jungle', 'swamp', 'island', 'cave', 'cliff',

  #Weather phenomena
  'cloud', 'rain', 'snow', 'ice', 'lightning', 'sun', 'moon', 'star', 'galaxy', 'planet', 'meteor', 'comet', 
  'eclipse', 'aurora', 'rainbow',

  #Buildings & infrastructure
  'house', 'apartment', 'skyscraper', 'hospital', 'school', 'library', 'church', 'temple', 'mosque', 'theater', 
  'restaurant', 'shop', 'stadium', 'airport', 'harbor', 'railway station', 'bus_station', 'bridge', 'tunnel', 
  'windmill', 'lighthouse', 'castle', 'pyramid', 'garage', 'greenhouse', 'factory',

  #City elements
  'street', 'sidewalk', 'crosswalk', 'traffic light', 'street_lamp', 'bus_stop', 'bench', 'fountain', 'statue', 
  'park', 'playground', 'mailbox', 'billboard', 'graffiti',

  #Transportation
  'car', 'bus', 'train', 'airplane', 'boat', 'bicycle', 'truck', 'motorcycle', 'subway', 'spaceship', 'submarine', 
  'taxi', 'ferry', 'tram', 'scooter', 'skateboard', 'helicopter', 'rocket'

  #Electronics
  'computer', 'smartphone', 'television', 'laptop', 'headphones', 'microphone', 'printer', 'game', 
  'remote control', 'music player', 'charger', 'tablet', 'smartwatch', 'speaker', 'projector', 
  'flashlight', 'keyboard', 'mouse', 'monitor', 'hard drive', 'usb drive'

  #Household items
  'furniture', 'kitchenware', 'home appliance', 'bed', 'sofa', 'chair', 
  'table', 'desk', 'wardrobe', 'lamp', 'mirror', 'clock', 'vase', 'potted plant', 'bookshelf', 'rug', 'curtain', 
  'pillow', 'blanket', 'towel', 'dishwasher', 'washing machine', 'dryer', 'fridge', 'oven', 'microwave', 
  'cooker', 'toaster', 'coffee', 'vacuum cleaner', 'iron', 'fan', 'heater', 
  'trash can', 'mop',

  #Clothing & accessories
  'shirt', 'pants', 'dress', 'skirt', 'jacket', 'sweater', 'shorts', 'socks', 'shoes', 'hat', 'scarf', 
  'gloves', 'sunglasses', 'watch', 'belt', 'tie', 'handbag', 'backpack', 'suitcase', 'wallet',

  #Food & drink
  'pizza', 'sandwich', 'hotdog', 'sushi', 'pasta', 'salad', 'soup',
  'bread', 'cheese', 'egg', 'milk', 'coffee', 'tea', 'juice', 'water', 'beer', 'wine', 'cocktail', 'smoothie', 
  'ice cream', 'cake', 'cookie', 'chocolate', 'candy', 'popcorn', 'cereal', 'rice', 'noodles', 'pancake',

  #Music
  'music', 'guitar', 'piano', 'drums', 'violin', 'flute', 'saxophone', 'trumpet', 'harp', 'accordion',

  #Photography equipment
  'camera', 'tripod', 'memory card', 'battery', 'drone',
  
  #Sports
  'sport', 'soccer', 'basketball', 'football', 'baseball', 'tennis', 'volleyball', 'golf', 'hockey', 'rugby',
  'cricket', 'bowling', 'skateboard', 'ski', 'snowboard', 'surfing', 'swimming', 'cycling', 'running', 'jogging',
  'hiking', 'climbing', 'yoga', 'boxing', 'karate', 'wrestling', 'fencing', 'gymnastics', 'weightlifting', 'dancing',
  
  #Organ
  'brain', 'heart', 'lungs', 'liver', 'kidney', 'stomach', 'intestine', 'bone', 'muscle', 'skin', 'hair', 'eye', 'ear',
  'nose', 'mouth', 'tongue', 'tooth', 'finger', 'hand', 'arm', 'leg', 'foot', 'head', 'neck', 'shoulder', 'chest', 'back',
  
  #Work
  'work', 'office', 'meeting', 'presentation',
  'whiteboard', 'pen', 'pencil', 'paper', 'notebook', 'folder', 'briefcase', 'calculator', 'scissors', 'stapler', 'tape',
  
  #School
  'classroom', 'blackboard', 'chalk', 'eraser',
  
  #Medical
  'hospital', 'doctor', 'nurse', 'patient', 'ambulance', 'syringe', 'pill', 'bandage', 'stretcher', 'wheelchair', 'crutch',
  
  #Law
  'lawyer', 'judge', 'police', 'handcuffs', 'badge', 'gun', 'handcuffs', 'prison', 'jail', 'court',

  #Others
  'human', 'person', 'female', 'male', 'robot', 'device', 'tool', 'weapon', 'vehicle', 'building', 'animal', 'plant', 'food', 'drink',
  'clothing', 'accessory', 'home appliance', 'cleaning tool', 'decoration', 'city', 'transportation',
  'electronics', 'clothes', 'clothing', 'accessories', 'flag'
]