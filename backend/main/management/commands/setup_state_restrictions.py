"""
Management command to set up state-specific restrictions for animal categories.
"""

from django.core.management.base import BaseCommand
from main.animal_models import AnimalCategory


class Command(BaseCommand):
    help = "Set up state-specific restrictions for animal categories"

    def handle(self, *args, **options):
        """Populate state restrictions for all animal categories."""
        
        # State restriction rules
        # Key: state code, Value: dict of restrictions for each category
        state_restrictions = {
            # Exotic Animals - Restricted in multiple states
            "exotics": {
                "CA": {"banned": False, "requires_license": True, "restrictions": "Permit required for most exotics"},
                "NY": {"banned": False, "requires_license": True, "restrictions": "DEC permit required"},
                "TX": {"banned": False, "requires_license": False, "restrictions": "Some species banned"},
                "FL": {"banned": False, "requires_license": True, "restrictions": "Limited importation"},
                "CO": {"banned": False, "requires_license": True, "restrictions": "Parks and Wildlife permit"},
                "IL": {"banned": False, "requires_license": True, "restrictions": "Dangerous animal permit"},
                "OH": {"banned": False, "requires_license": True, "restrictions": "Exotic animal permit"},
                "MA": {"banned": False, "requires_license": True, "restrictions": "DMF permit required"},
                "NJ": {"banned": False, "requires_license": True, "restrictions": "DEP license"},
                "DE": {"banned": False, "requires_license": True, "restrictions": "DNREC permit"},
                "MD": {"banned": False, "requires_license": True, "restrictions": "MDE permit"},
                "VA": {"banned": False, "requires_license": True, "restrictions": "DGIF permit"},
                "NC": {"banned": False, "requires_license": True, "restrictions": "Wildlife permit"},
                "SC": {"banned": False, "requires_license": True, "restrictions": "SCDNR permit"},
                "GA": {"banned": False, "requires_license": True, "restrictions": "DNR permit"},
                "FL": {"banned": False, "requires_license": True, "restrictions": "FWC permit"},
                "OR": {"banned": False, "requires_license": True, "restrictions": "ODFW permit"},
                "WA": {"banned": False, "requires_license": True, "restrictions": "WDFW permit"},
                "UT": {"banned": False, "requires_license": True, "restrictions": "DWR permit"},
                "AZ": {"banned": False, "requires_license": True, "restrictions": "AZGFD permit"},
            },
            # Reptiles - Commonly restricted
            "reptiles": {
                "CA": {"banned": False, "requires_license": False, "restrictions": "Some species require permits"},
                "NY": {"banned": False, "requires_license": False, "restrictions": "Some species restricted"},
                "MA": {"banned": False, "requires_license": False, "restrictions": "Pythons and boas restricted"},
            },
            # Small Mammals - Generally allowed but with restrictions
            "small_mammals": {
                "CA": {"banned": False, "requires_license": False, "restrictions": "Ferrets banned, prairie dogs banned"},
                "NY": {"banned": False, "requires_license": False, "restrictions": "Ferrets banned"},
                "DC": {"banned": False, "requires_license": False, "restrictions": "Ferrets banned, prairie dogs banned"},
                "HI": {"banned": False, "requires_license": False, "restrictions": "Many species banned due to island ecology"},
                "DE": {"banned": False, "requires_license": False, "restrictions": "Ferrets banned"},
                "IL": {"banned": False, "requires_license": False, "restrictions": "Ferrets banned, prairie dogs banned"},
                "MD": {"banned": False, "requires_license": False, "restrictions": "Ferrets banned"},
                "NE": {"banned": False, "requires_license": False, "restrictions": "Prairie dogs banned"},
                "OH": {"banned": False, "requires_license": False, "restrictions": "Ferrets banned"},
                "RI": {"banned": False, "requires_license": False, "restrictions": "Ferrets and prairie dogs banned"},
                "TX": {"banned": False, "requires_license": False, "restrictions": "Prairie dogs banned"},
                "UT": {"banned": False, "requires_license": False, "restrictions": "Prairie dogs banned"},
                "WA": {"banned": False, "requires_license": False, "restrictions": "Ferrets banned"},
                "WV": {"banned": False, "requires_license": False, "restrictions": "Ferrets banned"},
            },
            # Dogs - Generally allowed
            "dogs": {
                "general": {"banned": False, "requires_license": False, "restrictions": "Some breeds restricted, vaccination required"}
            },
            # Cats - Generally allowed
            "cats": {
                "general": {"banned": False, "requires_license": False, "restrictions": "Vaccination required"}
            },
            # Birds - Mostly allowed but CITES protected species restricted
            "birds": {
                "CA": {"banned": False, "requires_license": False, "restrictions": "Some species require CITES permits"},
                "general": {"banned": False, "requires_license": False, "restrictions": "CITES protected species need permits"}
            },
            # Livestock - Generally allowed but regulated
            "livestock": {
                "general": {"banned": False, "requires_license": False, "restrictions": "Local zoning and agricultural laws apply"}
            },
            # Adoption/Rehoming - Always allowed
            "adoption_rehoming": {
                "general": {"banned": False, "requires_license": False, "restrictions": "No licensing required"}
            },
        }

        # Map state abbreviations to full name for reference
        state_names = {
            "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
            "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
            "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
            "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
            "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
            "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
            "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
            "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
            "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
            "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
            "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
            "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
            "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia"
        }

        # Update each category with state restrictions
        categories = AnimalCategory.objects.all()
        for category in categories:
            animal_type = category.animal_type
            
            if animal_type in state_restrictions:
                category.state_restrictions = state_restrictions[animal_type]
                category.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Updated {category.name} ({animal_type}) with state restrictions"
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"No restrictions defined for {category.name} ({animal_type})"
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                "State restrictions setup complete!"
            )
        )
