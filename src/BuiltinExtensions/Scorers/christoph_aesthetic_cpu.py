import torch
import pytorch_lightning as pl
import torch.nn as nn
import clip
import numpy as np

class MLP(pl.LightningModule):
    def __init__(self, input_size, xcol='emb', ycol='avg_rating'):
        super().__init__()
        self.input_size = input_size
        self.xcol = xcol
        self.ycol = ycol
        self.layers = nn.Sequential(
            nn.Linear(self.input_size, 1024),
            nn.Dropout(0.2),
            nn.Linear(1024, 128),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.Dropout(0.1),
            nn.Linear(64, 16),
            nn.Linear(16, 1)
        )

    def forward(self, x):
        return self.layers(x)

def normalized(a, axis=-1, order=2):
    l2 = np.atleast_1d(np.linalg.norm(a, order, axis))
    l2[l2 == 0] = 1
    return a / np.expand_dims(l2, axis)

class AestheticPredictor():
    model = None
    model2 = None

    def to(self, dev):
        self.model.to(dev)
        self.model2.to(dev)

    def load(self, name, device):
        self.model = MLP(768)
        s = torch.load(name, map_location=torch.device('cpu'))
        self.model.load_state_dict(s)

        self.model.to(device).to(torch.float32)
        self.model.eval()

        self.model2, self.preprocess = clip.load("ViT-L/14", device=device)
        self.model2.to(device).to(torch.float32)
        self.model2.eval()

    def predict(self, img):
        image = self.preprocess(img).unsqueeze(0).to(self.model.device)
        image = image.to(torch.float32)

        with torch.no_grad():
            image_features = self.model2.encode_image(image)
            im_emb_arr = torch.from_numpy(normalized(image_features.cpu().numpy())).to(self.model.device).to(torch.float32)

            prediction = self.model(im_emb_arr)
            return prediction.cpu().detach().numpy()
