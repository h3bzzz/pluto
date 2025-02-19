import pandas as pd
import numpy as np
import logging
import joblib
import warnings
import shap

from sklearn.model_selection import train_test_split, RandomizedSearchCV, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.ensemble import RandomForestClassifier, ExtraTresssClassifier, StackingClassifier
from sklearn.linear_model import LogisticRegression
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline


warnings.filterwarnings('ignore')


class TrainingPipeline:
    def __init__(self, label_column='label'):
        self.label_column = label_column
        self.logger = logging.getLogger('IDSTrainingPipeline')
        self.logger.setLevel(logging.INFO)
        ch = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        ch.setFormatter(formatter)
        if not self.logger.handlers:
            self.logger.addHandler(ch)
        self.preprocessor = None
        self.model_pipeline = None


    def load_preprocess(self, dataset_paths):
        data_list = []
        for path in dataset_paths:
            try:
                df = pd.read_csv('/home/neo/Datasets/CTU_13.csv')
                # ADD more here
                #
                #
                df['dataset_source'] = path.split('/')[-1]
                data_list.append(df)
                self.logger.info(f"Loaded dataset: {path}")
                return data

    def build_preprocessor(self, data):
            feature_cols = data.columns.drop(self.label_column)
            numeric_cols = data[feature_cols].select_dtypes(include=['int64', 'float64']).column.tolist()
            categorical_cols = data[feature_cols].select_dtypes(include=['object']).columns.tolist()

            self.logger.info(f"Numeric columns: {numeric_cols}")
            self.logger.info(f"Categorical columns: {categorical_cols}")

            numeric_pipeline = Pipeline([
                ('imputer', SimpleImputer(strategy='median')),
                ('scaler', StandardScaler())
            )]

            categorical_pipeline = Pipeline([
                ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
                ('onehot', OneHotEncoder(handle_unknown='ignore'))
            ])

            preprocessor = ColumnTransformer(transformers=[
                ('num', numeric_pipeline, numeric_cols),
                ('cat', categorical_pipeline, categorical_cols)
            ])
            self.preprocessor = preprocessor
            return preprocessor

        def prepare_data(self, data):
            X = data[self.label_column, axis=1]
            y = data[self.label_column]
            X_train, X_test, y_train, y_test, = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y)
            self.logger.info(f"Training set shape: {X_train.shape},Test set shape: {X_test.shape}")
            return X_train, X_test, y_train, y_test


        def build_model(self):
            estimators = [
                ('rf', RandomForestClassifier(random_state=42, n_jobs=-1)),
                ('xgb', XGBClassifier(random_state=42, use_label_encoder=False, eval_metric='logloss')),
                ('et', ExtraTreesClassifier(random_state=42, n_jobs=-1))
            ]

            final_estimator = LogisticRegression(max_iter=1000)

            stacking_clf = StackingClassifier(
                estimators=estimators,
                final_estimator=final_estimator,
                n_jobs=-1,
                passthrough=False
            )

            self.model_pipeline = ImbPipeline(steps=[
                ('preprocessor', self.preprocessor),
                ('smote', SMOTE(random_state=42)),
                ('classifier', stacking_clf)
            ])
            return self.model_pipeline


        def train_model(self, X_train, y_train):
            param_distributions = {
                'classifier__rf__n_estimators': [100, 200, 300],
                'classifier__rf__max_depth': [None, 10, 20],
                'classifier__xgb__n_estimators': [100, 200, 300],
                'classifier__xgb__max_depth': [3, 5, 7],
                'classifier__et__n_estimators': [100, 200, 300],
                'classifier__final_estimator_C': [0.1, 1, 10],
            }

            self.logger.info("Starting hyperparameter tuning...")
            search = RandomizedSearchCV(
                self.model_pipeline,
                param_distributions,
                n_iter=10,
                cv=5,
                n_jobs=-1
                verbose=2,
                random_state=42
            )
            search.fit()
            )
            )
                                        ])
            ])
