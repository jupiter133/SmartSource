"""Generates seed.csv: placeholder prices so both quote lanes work end to end. Every row is_placeholder=TRUE."""
import csv
cols=open('columns.txt').read().strip().split(',')
iphones=[("iPhone 11",1,False),("iPhone 12",2,False),("iPhone 13",3,True),("iPhone 13 Pro",4,False),("iPhone 14",4,True),("iPhone 14 Pro",5,False),("iPhone 15",5,True),("iPhone 15 Pro",6,True),("iPhone 15 Pro Max",7,False),("iPhone 16",6,True),("iPhone 16 Pro",8,False)]
samsung=[("Galaxy A54 5G",1,False),("Galaxy S21",2,False),("Galaxy S22",3,False),("Galaxy S23",4,True),("Galaxy S23 Ultra",7,False),("Galaxy S24",5,True),("Galaxy S24 Ultra",8,False)]
W={"Aftermarket":90,"Aftermarket Plus":180,"Premium":365}
PH="PLACEHOLDER: "
def tiers(issue,L,brand):
  if issue=="Screen": return [("Aftermarket",89+12*L,49,PH+"budget replacement screen",False),("Aftermarket Plus",129+18*L,49,PH+"higher-grade replacement screen",True),("Premium",169+28*L,49,PH+"top-grade screen",False)]
  if issue=="Battery":
    t=[("Aftermarket",69+4*L,39,PH+"replacement battery",False),("Premium",109+7*L,39,PH+"top-grade battery",True)]
    if brand=="Apple": t.insert(1,("Aftermarket Plus",89+5*L,39,PH+"higher-capacity-tested battery",False))
    return t
  if issue=="Charging port": return [("Aftermarket Plus",89+5*L,59,PH+"replacement charging port assembly",False)]
  if issue=="Back glass": return [("Aftermarket",99+10*L,69,PH+"replacement back glass",False),("Premium",149+14*L,69,PH+"top-grade back glass",True)]
  if issue=="Rear camera": return [("Aftermarket",99+12*L,49,PH+"replacement rear camera",False),("Premium",149+18*L,49,PH+"top-grade rear camera",True)]
rows=[]
for brand,lst in (("Apple",iphones),("Samsung",samsung)):
  for model,L,pop in lst:
    for issue in ["Screen","Battery","Charging port","Back glass","Rear camera"]:
      for tier,price,lab,desc,rec in tiers(issue,L,brand):
        oos = model=="iPhone 16 Pro" and issue=="Screen" and tier=="Premium"
        rows.append(dict(lane="A",brand=brand,model=model,category="phone",spec="",issue_or_service=issue,part_tier=tier,tier_description=desc,
          parts_price=f"{price-lab:.2f}",labour=f"{lab:.2f}",diagnostic_fee="",range_low="",range_high="",turnaround_days=2 if tier=="Premium" and issue=="Screen" else 1,
          warranty_days=W[tier],in_stock="FALSE" if oos else "TRUE",oos_mode="show" if oos else "hide",oos_extra_days=5 if oos else 0,recommended="TRUE" if rec else "FALSE",popular="TRUE" if pop else "FALSE",is_placeholder="TRUE"))
svc={"Motherboard / micro-soldering":(49,149,399,3),"Data recovery":(79,199,599,4),"Water damage":(49,99,349,2),"No power":(49,99,299,3),"Boot loop":(49,79,249,3),"Board-level fault":(49,149,399,3)}
mult={"Phone":1,"Tablet":1.2,"Laptop":1.5}
for s,(fee,lo,hi,d) in svc.items():
  for dev,m in mult.items():
    rows.append(dict(lane="B",brand="",model="",category="",spec=dev,issue_or_service=s,part_tier="",tier_description="",parts_price="",labour="",
      diagnostic_fee=f"{round(fee*(1 if dev=='Phone' else m+0.0)):.2f}",range_low=f"{round(lo*m):.2f}",range_high=f"{round(hi*m):.2f}",turnaround_days=d,warranty_days=0,
      in_stock="TRUE",oos_mode="hide",oos_extra_days=0,recommended="FALSE",popular="FALSE",is_placeholder="TRUE"))
w=csv.DictWriter(open('seed.csv','w',newline=''),fieldnames=cols); w.writeheader(); w.writerows(rows)
print(len(rows),"rows")
